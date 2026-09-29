const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const NEBULA_BASE = 'https://api.utdnebula.com';
const NEBULA_KEY = process.env.NEBULA_API_KEY || '';

async function nebulaFetch(path, params = {}) {
  if (!NEBULA_KEY) return null;
  const url = new URL(`${NEBULA_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': NEBULA_KEY, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Nebula API error: ${res.status}`);
  return res.json();
}

// GET /api/nebula/course - search courses from Nebula
router.get('/course', asyncHandler(async (req, res) => {
  const { subject_prefix, course_number } = req.query;
  try {
    const data = await nebulaFetch('/course', { subject_prefix, course_number });
    res.json(data || { message: 'Nebula API key not configured', data: [] });
  } catch (err) {
    res.json({ message: err.message, data: [] });
  }
}));

// GET /api/nebula/section - get sections for a course
router.get('/section', asyncHandler(async (req, res) => {
  const { course_reference_number, term_code } = req.query;
  try {
    const data = await nebulaFetch('/section', { course_reference_number, term_code });
    res.json(data || { message: 'Nebula API key not configured', data: [] });
  } catch (err) {
    res.json({ message: err.message, data: [] });
  }
}));

// GET /api/nebula/grades - grade distribution
router.get('/grades', asyncHandler(async (req, res) => {
  const { subject_prefix, course_number, professor } = req.query;
  try {
    const data = await nebulaFetch('/grades/overall', { subject_prefix, course_number, professor });
    res.json(data || { message: 'Nebula API key not configured', data: [] });
  } catch (err) {
    res.json({ message: err.message, data: [] });
  }
}));

module.exports = router;
