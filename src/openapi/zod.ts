import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi"
import { z } from "../api/zod.ts"

extendZodWithOpenApi(z)

export { z }
