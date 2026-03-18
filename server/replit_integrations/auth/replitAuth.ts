import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

// Detect which auth provider to use.
// Auth0 takes priority when AUTH0_DOMAIN is set; otherwise fall back to Replit OIDC.
const useAuth0 = !!process.env.AUTH0_DOMAIN;

const getOidcConfig = memoize(
  async () => {
    if (useAuth0) {
      const domain = process.env.AUTH0_DOMAIN!;
      const clientId = process.env.AUTH0_CLIENT_ID;
      const clientSecret = process.env.AUTH0_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error(
          "Missing Auth0 configuration: AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET are required when AUTH0_DOMAIN is set"
        );
      }
      return await client.discovery(
        new URL(`https://${domain}/`),
        clientId,
        { client_secret: clientSecret }
      );
    }

    // Replit OIDC fallback (for development inside Replit)
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  if (useAuth0) {
    // Auth0 uses standard OIDC claims
    await authStorage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["given_name"] ?? claims["nickname"] ?? null,
      lastName: claims["family_name"] ?? null,
      profileImageUrl: claims["picture"] ?? null,
    });
  } else {
    // Replit OIDC uses custom claim names
    await authStorage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (callbackURL: string) => {
    const prefix = useAuth0 ? "auth0" : "replitauth";
    const strategyName = `${prefix}:${callbackURL}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
    return strategyName;
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const callbackURL = `https://${req.hostname}/api/callback`;
    const strategyName = ensureStrategy(callbackURL);
    passport.authenticate(strategyName, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    const callbackURL = `https://${req.hostname}/api/callback`;
    const strategyName = ensureStrategy(callbackURL);
    passport.authenticate(strategyName, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      const returnTo = `${req.protocol}://${req.hostname}`;
      try {
        const clientId = useAuth0
          ? process.env.AUTH0_CLIENT_ID!
          : process.env.REPL_ID!;
        const logoutUrl = client.buildEndSessionUrl(config, {
          client_id: clientId,
          post_logout_redirect_uri: returnTo,
        }).href;
        res.redirect(logoutUrl);
      } catch {
        res.redirect(returnTo);
      }
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
