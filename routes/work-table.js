const express = require('express');
const router = express.Router();
const { connection } = require("../config/passport-config");

// GET all work tables
router.get('/', (req, res) => {
  const query = `
    SELECT wt.*, e.Employ_name
    FROM work_table wt
    LEFT JOIN employee e ON wt.Employ_id = e.Employ_id
    ORDER BY wt.Work_date DESC, wt.Work_time ASC
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching work tables:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        data: null
      });
    }

    // Format dates for frontend
    const formattedResults = results.map(item => ({
      ...item,
      Work_date: item.Work_date, // ส่งออกตรง ๆ ไม่แปลง
      Work_time: item.Work_time ? item.Work_time.slice(0, 5) : null
    }));

    res.json({
      success: true,
      message: 'Work tables retrieved successfully',
      data: formattedResults
    });
  });
});

// GET work table by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT wt.*, e.Employ_name
    FROM work_table wt
    LEFT JOIN employee e ON wt.Employ_id = e.Employ_id
    WHERE wt.Work_id = ?
  `;

  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching work table:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        data: null
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work table not found',
        data: null
      });
    }

    // Format dates for frontend
    const formattedResult = {
      ...results[0],
      Work_date: results[0].Work_date, // ส่งออกตรง ๆ ไม่แปลง
      Work_time: results[0].Work_time ? results[0].Work_time.slice(0, 5) : null
    };

    res.json({
      success: true,
      message: 'Work table retrieved successfully',
      data: formattedResult
    });
  });
});

// POST create new work table
router.post('/', (req, res) => {
  const { Work_date, Work_time, Work_position, Employ_id } = req.body;

  // Validation
  if (!Work_date || !Work_time || !Work_position || !Employ_id) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required',
      data: null
    });
  }

  // Work_date: Creation date (when the work schedule was created)
  // Work_time: Work schedule date (when the employee will work)
  const query = `
    INSERT INTO work_table (Work_date, Work_time, Work_position, Employ_id)
    VALUES (?, ?, ?, ?)
  `;

  connection.query(query, [Work_date, Work_time, Work_position, Employ_id], (err, result) => {
    if (err) {
      console.error('Error creating work table:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        data: null
      });
    }

    // Get the created work table with employee name
    const getQuery = `
      SELECT wt.*, e.Employ_name
      FROM work_table wt
      LEFT JOIN employee e ON wt.Employ_id = e.Employ_id
      WHERE wt.Work_id = ?
    `;

    connection.query(getQuery, [result.insertId], (err, results) => {
      if (err) {
        console.error('Error fetching created work table:', err);
        return res.status(500).json({
          success: false,
          message: 'Work table created but error fetching data',
          data: null
        });
      }

      // Format dates for frontend
      const formattedResult = {
        ...results[0],
        Work_date: results[0].Work_date, // ส่งออกตรง ๆ ไม่แปลง
        Work_time: results[0].Work_time ? results[0].Work_time.slice(0, 5) : null
      };

      res.status(201).json({
        success: true,
        message: 'Work table created successfully',
        data: formattedResult
      });
    });
  });
});

// PUT update work table
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { Work_date, Work_time, Work_position, Employ_id } = req.body;

  // Validation
  if (!Work_date || !Work_time || !Work_position || !Employ_id) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required',
      data: null
    });
  }

  const query = `
    UPDATE work_table
    SET Work_date = ?, Work_time = ?, Work_position = ?, Employ_id = ?
    WHERE Work_id = ?
  `;

  connection.query(query, [Work_date, Work_time, Work_position, Employ_id, id], (err, result) => {
    if (err) {
      console.error('Error updating work table:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        data: null
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work table not found',
        data: null
      });
    }

    // Get the updated work table with employee name
    const getQuery = `
      SELECT wt.*, e.Employ_name
      FROM work_table wt
      LEFT JOIN employee e ON wt.Employ_id = e.Employ_id
      WHERE wt.Work_id = ?
    `;

    connection.query(getQuery, [id], (err, results) => {
      if (err) {
        console.error('Error fetching updated work table:', err);
        return res.status(500).json({
          success: false,
          message: 'Work table updated but error fetching data',
          data: null
        });
      }

      // Format dates for frontend
      const formattedResult = {
        ...results[0],
        Work_date: results[0].Work_date, // ส่งออกตรง ๆ ไม่แปลง
        Work_time: results[0].Work_time ? results[0].Work_time.slice(0, 5) : null
      };

      res.json({
        success: true,
        message: 'Work table updated successfully',
        data: formattedResult
      });
    });
  });
});

// DELETE work table
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM work_table WHERE Work_id = ?';

  connection.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error deleting work table:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        data: null
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work table not found',
        data: null
      });
    }

    res.json({
      success: true,
      message: 'Work table deleted successfully',
      data: null
    });
  });
});

// GET work tables by employee ID
router.get('/employee/:employeeId', (req, res) => {
  const { employeeId } = req.params;
  const query = `
    SELECT wt.*, e.Employ_name
    FROM work_table wt
    LEFT JOIN employee e ON wt.Employ_id = e.Employ_id
    WHERE wt.Employ_id = ?
    ORDER BY wt.Work_date DESC, wt.Work_time ASC
  `;

  connection.query(query, [employeeId], (err, results) => {
    if (err) {
      console.error('Error fetching employee work tables:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        data: null
      });
    }

    // Format dates for frontend
    const formattedResults = results.map(item => ({
      ...item,
      Work_date: item.Work_date, // ส่งออกตรง ๆ ไม่แปลง
      Work_time: item.Work_time ? item.Work_time.slice(0, 5) : null
    }));

    res.json({
      success: true,
      message: 'Employee work tables retrieved successfully',
      data: formattedResults
    });
  });
});

// GET work tables by date range
router.get('/date-range/:startDate/:endDate', (req, res) => {
  const { startDate, endDate } = req.params;
  const query = `
    SELECT wt.*, e.Employ_name
    FROM work_table wt
    LEFT JOIN employee e ON wt.Employ_id = e.Employ_id
    WHERE wt.Work_date BETWEEN ? AND ?
    ORDER BY wt.Work_date ASC, wt.Work_time ASC
  `;

  connection.query(query, [startDate, endDate], (err, results) => {
    if (err) {
      console.error('Error fetching work tables by date range:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        data: null
      });
    }

    // Format dates for frontend
    const formattedResults = results.map(item => ({
      ...item,
      Work_date: item.Work_date, // ส่งออกตรง ๆ ไม่แปลง
      Work_time: item.Work_time ? item.Work_time.slice(0, 5) : null
    }));

    res.json({
      success: true,
      message: 'Work tables by date range retrieved successfully',
      data: formattedResults
    });
  });
});

module.exports = router;
