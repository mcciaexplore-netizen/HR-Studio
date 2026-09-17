import server from "../dist/vercel.cjs";

// Import the built bundle: Node's ESM loader cannot resolve extensionless TS imports.
// Vercel owns the listener. All /api requests are routed here by vercel.json.
export default server.createVercelHandler();
