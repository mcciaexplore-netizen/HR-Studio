import { createVercelHandler } from "../server/vercel";

// Vercel owns the listener. All /api requests are routed here by vercel.json.
export default createVercelHandler();
