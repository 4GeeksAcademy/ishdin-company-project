import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const allowedFiles = new Set([
  "index.html",
  "application.html",
  "styles.css",
  "validation.js",
]);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

export async function GET(request, context) {
  const params = await context.params;
  const segments = params?.path ?? [];

  // When visiting http://localhost:3000/,
  // serve index.html.
  const requestedFile =
    segments.length === 0 ? "index.html" : segments.join("/");

  // Only allow the website files we expect.
  if (!allowedFiles.has(requestedFile)) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const filePath = path.join(process.cwd(), requestedFile);
    const fileContent = await readFile(filePath);

    const extension = path.extname(requestedFile);

    return new Response(fileContent, {
      status: 200,
      headers: {
        "Content-Type":
          contentTypes[extension] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}