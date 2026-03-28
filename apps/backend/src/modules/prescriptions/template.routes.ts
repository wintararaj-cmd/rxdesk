import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import * as TemplateService from './template.service';

const router = Router();

/**
 * @route   POST /api/v1/prescriptions/templates
 * @desc    Create a new doctor prescription template
 * @access  Private (Doctor)
 */
router.post('/', requireRole('doctor'), async (req: any, res, next) => {
  try {
    const userId = req.user!.id;
    const template = await TemplateService.createTemplate(userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: template,
    });
  } catch (err) { next(err); }
});

/**
 * @route   GET /api/v1/prescriptions/templates
 * @desc    Get all templates for the logged-in doctor
 * @access  Private (Doctor)
 */
router.get('/', requireRole('doctor'), async (req: any, res, next) => {
  try {
    const userId = req.user!.id;
    const templates = await TemplateService.getTemplates(userId);
    res.json({
      success: true,
      data: templates,
    });
  } catch (err) { next(err); }
});

/**
 * @route   GET /api/v1/prescriptions/templates/:id
 * @desc    Get template details by ID
 * @access  Private (Doctor)
 */
router.get('/:id', requireRole('doctor'), async (req: any, res, next) => {
  try {
    const userId = req.user!.id;
    const template = await TemplateService.getTemplateById(req.params.id, userId);
    res.json({
      success: true,
      data: template,
    });
  } catch (err) { next(err); }
});

/**
 * @route   DELETE /api/v1/prescriptions/templates/:id
 * @desc    Delete a template
 * @access  Private (Doctor)
 */
router.delete('/:id', requireRole('doctor'), async (req: any, res, next) => {
  try {
    const userId = req.user!.id;
    const result = await TemplateService.deleteTemplate(req.params.id, userId);
    res.json({
      success: true,
      message: 'Template deleted successfully',
      ...result,
    });
  } catch (err) { next(err); }
});

export default router;
