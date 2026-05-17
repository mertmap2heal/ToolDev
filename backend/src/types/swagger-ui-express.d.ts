/**
 * Ambient types for swagger-ui-express.
 *
 * NX-5 (#451): swagger-ui-express@5.0.1 ships no bundled `.d.ts` and no
 * `@types/swagger-ui-express` is declared in `package.json` (the ticket
 * approved exactly three packages — swagger-jsdoc, swagger-ui-express,
 * @types/swagger-jsdoc — and `rules.md` §2 forbids adding a fourth).
 *
 * This declares only the surface NX-5 uses: `serve` (the asset-serving
 * middleware array) and `setup` (the request handler that renders the UI
 * for a given OpenAPI document). Mirrors the existing local ambient
 * declarations in this directory (`archiver.d.ts`, `pdfkit.d.ts`).
 */
declare module 'swagger-ui-express' {
  import { RequestHandler } from 'express'

  interface SwaggerUiOptions {
    customCss?: string
    customCssUrl?: string | string[]
    customJs?: string | string[]
    customSiteTitle?: string
    customfavIcon?: string
    explorer?: boolean
    swaggerOptions?: Record<string, unknown>
    [key: string]: unknown
  }

  /**
   * Express middleware array that serves the static Swagger UI assets.
   */
  export const serve: RequestHandler[]

  /**
   * Build the request handler that renders the Swagger UI for a given
   * OpenAPI document object.
   */
  export function setup(
    spec?: object | null,
    options?: SwaggerUiOptions | null,
    swaggerOptions?: Record<string, unknown> | null,
    customCss?: string | null,
    customfavIcon?: string | null,
    customSiteTitle?: string | null,
  ): RequestHandler

  const swaggerUi: {
    serve: RequestHandler[]
    setup: typeof setup
  }
  export default swaggerUi
}
