import { Router, Request, Response } from 'express';
import { getAllLanguages, getLanguageById } from '../config/languages';

const router = Router();

// GET /api/languages - List all supported languages
router.get('/', (_req: Request, res: Response) => {
  const languages = getAllLanguages().map((lang) => ({
    id: lang.id,
    name: lang.name,
    extension: lang.extension,
    monacoLanguage: lang.monacoLanguage,
    defaultCode: lang.defaultCode,
  }));
  res.json({ success: true, data: languages });
});

// GET /api/languages/:id - Get language details
router.get('/:id', (req: Request, res: Response) => {
  const lang = getLanguageById(req.params.id);
  if (!lang) {
    res.status(404).json({ success: false, error: 'Language not found' });
    return;
  }
  res.json({
    success: true,
    data: {
      id: lang.id,
      name: lang.name,
      extension: lang.extension,
      monacoLanguage: lang.monacoLanguage,
      defaultCode: lang.defaultCode,
    },
  });
});

export default router;
