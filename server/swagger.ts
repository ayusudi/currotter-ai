import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Currotter API",
      version: "1.0.0",
      description:
        "AI-powered photo curation API that removes duplicates, blurry shots, and low-quality images from event photo collections using a multi-agent AI pipeline.",
    },
    servers: [
      {
        url: "/",
        description: "Current server",
      },
    ],
    tags: [
      {
        name: "Curation",
        description: "Photo upload and AI curation pipeline",
      },
      {
        name: "Sessions",
        description: "Curation session management and results",
      },
    ],
  },
  apis: ["./server/routes.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Currotter API Documentation",
  }));

  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}
