const express = require('express');
const router = express.Router();
const { connection } = require('../config/passport-config');

// Legacy Promotion API for backward compatibility
// This will return empty array since we migrated to score_rewards

// GET all promotions (legacy - returns empty)
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Promotions migrated to score_rewards',
    data: []
  });
});

// GET promotion by ID (legacy - returns empty)
router.get('/:id', (req, res) => {
  res.json({
    success: true,
    message: 'Promotion not found - migrated to score_rewards',
    data: null
  });
});

// POST new promotion (legacy - redirects to score_rewards)
router.post('/', (req, res) => {
  res.status(301).json({
    success: false,
    message: 'Promotions have been migrated to score_rewards. Please use /api/score/rewards instead.',
    data: null
  });
});

// PUT update promotion (legacy - redirects to score_rewards)
router.put('/:id', (req, res) => {
  res.status(301).json({
    success: false,
    message: 'Promotions have been migrated to score_rewards. Please use /api/score/rewards instead.',
    data: null
  });
});

// DELETE promotion (legacy - redirects to score_rewards)
router.delete('/:id', (req, res) => {
  res.status(301).json({
    success: false,
    message: 'Promotions have been migrated to score_rewards. Please use /api/score/rewards instead.',
    data: null
  });
});

module.exports = router;
