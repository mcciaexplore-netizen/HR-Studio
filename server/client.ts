import express, { type Express } from 'express';
import { resolve } from 'node:path';

export function serveClient(app: Express, publicPath: string) {
  app.use((_req, res, next) => {
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: http:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    next();
  });
  app.use(express.static(publicPath, { index: false, dotfiles: 'ignore' }));
  // Navigation is state-based: only the root is a page. Unknown file paths stay 404.
  app.get('/', (_req, res) => res.sendFile(resolve(publicPath, 'index.html')));
  app.use((_req, res) => res.sendStatus(404));
}
