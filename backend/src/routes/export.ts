// Export routes (S015)
import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { exportContentAsMarkdown, exportBulkAsMarkdown, generateExportManifest } from '../services/export.js';
import archiver from 'archiver';
import { logger } from '../config/logger.js';

const log = logger.child({ route: 'export' });

export const exportRouter = Router();

// All export routes require authentication
exportRouter.use(authenticateToken);

// GET /api/export/:id - Export single content as markdown
exportRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const result = await exportContentAsMarkdown(contentId, req.user!.id);

    if (!result) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);

    return res.send(result.content);
  } catch (error) {
    return next(error);
  }
});

// POST /api/export/bulk - Export multiple content items as ZIP
exportRouter.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentIds } = req.body;

    // Validate contentIds if provided
    if (contentIds && !Array.isArray(contentIds)) {
      return res.status(400).json({ error: 'contentIds must be an array' });
    }

    const exports = await exportBulkAsMarkdown(
      req.user!.id,
      contentIds as string[] | undefined
    );

    if (exports.length === 0) {
      return res.status(404).json({ error: 'No content found to export' });
    }

    // Generate export manifest
    const manifest = generateExportManifest(exports);

    // Set headers for ZIP download
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="remember-export-${timestamp}.zip"`);

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Handle archive errors
    archive.on('error', (err: Error) => {
      log.error({ err, userId: req.user!.id }, 'Archive creation failed');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create archive' });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive
    for (const file of manifest) {
      archive.append(file.content, { name: file.path });
    }

    // Finalize archive
    await archive.finalize();
  } catch (error) {
    return next(error);
  }
});

// GET /api/export/preview/:id - Get markdown preview without downloading
exportRouter.get('/preview/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.id as string;
    const result = await exportContentAsMarkdown(contentId, req.user!.id);

    if (!result) {
      return res.status(404).json({ error: 'Content not found' });
    }

    return res.json({
      filename: result.filename,
      content: result.content,
    });
  } catch (error) {
    return next(error);
  }
});
