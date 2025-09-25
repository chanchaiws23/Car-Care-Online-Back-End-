const express = require("express");
const { connection } = require("../config/passport-config");
const router = express.Router();

// ฟังก์ชันคำนวณแต้มจากราคา
function calculateScore(price, type = 'service') {
  let scoreRate = 0.1; // 1 บาท = 1 แต้ม สำหรับบริการ

  if (type === 'package') {
    scoreRate = 0.2; // 1 บาท = 1.5 แต้ม สำหรับแพ็คเกจ
  } else if (type === 'review') {
    return price; // สำหรับรีวิว ใช้แต้มตามที่กำหนด
  }

  return Math.floor(price * scoreRate);
}

// ฟังก์ชันคำนวณแต้มจากรีวิว
function calculateReviewScore(reviewPoint) {
  const point = parseInt(reviewPoint);
  if (point === 5) return 10;
  if (point === 4) return 5;
  if (point === 3) return 2;
  return 0;
}

// API ดึงข้อมูลแต้มของ user
router.get('/user/:userId', (req, res) => {
  const userId = req.params.userId;

  const query = `
    SELECT
      us.User_id,
      us.Total_earned,
      us.Total_used,
      us.Current_balance,
      us.Last_updated
    FROM user_score us
    WHERE us.User_id = ?
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', data: null });

    if (results.length === 0) {
      // สร้าง user_score record ใหม่ถ้ายังไม่มี
      const createQuery = 'INSERT INTO user_score (User_id, Total_earned, Total_used, Current_balance) VALUES (?, 0, 0, 0)';
      connection.query(createQuery, [userId], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error', data: null });

        res.json({
          success: true,
          message: 'User score created',
          data: {
            User_id: parseInt(userId),
            Total_earned: 0,
            Total_used: 0,
            Current_balance: 0,
            Last_updated: new Date().toISOString()
          }
        });
      });
    } else {
      res.json({ success: true, message: 'User score retrieved', data: results[0] });
    }
  });
});

// API เพิ่มแต้มจากการชำระเงิน
router.post('/earn', (req, res) => {
  const { User_id, Payment_id, Reser_id, amount, type = 'service', source = 'payment' } = req.body;

  if (!User_id || !amount) {
    return res.status(400).json({ success: false, message: 'User_id and amount are required' });
  }

  const earnedScore = calculateScore(amount, type);

  // เพิ่มข้อมูลในตาราง score
  const scoreQuery = `
    INSERT INTO score (
      Score_detail, Score_total, Score_earned, Score_used, Score_balance,
      Score_type, Score_source, Payment_id, Reser_id, User_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // เพิ่มข้อมูลในตาราง score_history
  const historyQuery = `
    INSERT INTO score_history (
      User_id, Score_amount, Score_type, Score_source, Score_description,
      Payment_id, Reser_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  // อัปเดต user_score
  const updateUserScoreQuery = `
    UPDATE user_score
    SET Total_earned = Total_earned + ?, Current_balance = Current_balance + ?, Last_updated = NOW()
    WHERE User_id = ?
  `;

  // ใช้ Promise-based approach แทน transaction
  const scoreDetail = `ได้รับแต้มจากการ${source === 'payment' ? 'ชำระเงิน' : source}`;
  const historyDescription = `ได้รับ ${earnedScore} แต้มจากการ${source === 'payment' ? 'ชำระเงิน' : source} จำนวน ${amount} บาท`;

  // เพิ่ม score record
  connection.query(scoreQuery, [
    scoreDetail, earnedScore.toString(), earnedScore, 0, earnedScore,
    'earn', source, Payment_id, Reser_id, User_id
  ], (err, scoreResult) => {
    if (err) {
      console.error('Error inserting score:', err);
      return res.status(500).json({ success: false, message: 'Score insert error', data: null });
    }

    // เพิ่ม history record
    connection.query(historyQuery, [
      User_id, earnedScore, 'earn', source, historyDescription, Payment_id, Reser_id
    ], (err, historyResult) => {
      if (err) {
        console.error('Error inserting history:', err);
        return res.status(500).json({ success: false, message: 'History insert error', data: null });
      }

      // อัปเดต user_score
      connection.query(updateUserScoreQuery, [earnedScore, earnedScore, User_id], (err, updateResult) => {
        if (err) {
          console.error('Error updating user score:', err);
          return res.status(500).json({ success: false, message: 'User score update error', data: null });
        }

        res.json({
          success: true,
          message: 'Score earned successfully',
          data: {
            earned_score: earnedScore,
            total_balance: earnedScore,
            source: source
          }
        });
      });
    });
  });
});

// API เพิ่มแต้มจากรีวิว
router.post('/earn-review', (req, res) => {
  const { User_id, Reser_id, review_point, review_comment } = req.body;

  if (!User_id || !review_point) {
    return res.status(400).json({ success: false, message: 'User_id and review_point are required' });
  }

  const earnedScore = calculateReviewScore(review_point);

  if (earnedScore === 0) {
    return res.status(400).json({ success: false, message: 'Invalid review point', data: null });
  }

  // เพิ่มข้อมูลในตาราง score
  const scoreQuery = `
    INSERT INTO score (
      Score_detail, Score_total, Score_earned, Score_used, Score_balance,
      Score_type, Score_source, Reser_id, User_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // เพิ่มข้อมูลในตาราง score_history
  const historyQuery = `
    INSERT INTO score_history (
      User_id, Score_amount, Score_type, Score_source, Score_description, Reser_id
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;

  // อัปเดต user_score
  const updateUserScoreQuery = `
    UPDATE user_score
    SET Total_earned = Total_earned + ?, Current_balance = Current_balance + ?, Last_updated = NOW()
    WHERE User_id = ?
  `;

  // ใช้ Promise-based approach แทน transaction
  const scoreDetail = `ได้รับแต้มจากการรีวิว ${review_point} ดาว`;
  const historyDescription = `ได้รับ ${earnedScore} แต้มจากการรีวิว ${review_point} ดาว${review_comment ? ` - ${review_comment}` : ''}`;

  // เพิ่ม score record
  connection.query(scoreQuery, [
    scoreDetail, earnedScore.toString(), earnedScore, 0, earnedScore,
    'bonus', 'review', Reser_id, User_id
  ], (err, scoreResult) => {
    if (err) {
      console.error('Error inserting score:', err);
      return res.status(500).json({ success: false, message: 'Score insert error', data: null });
    }

    // เพิ่ม history record
    connection.query(historyQuery, [
      User_id, earnedScore, 'bonus', 'review', historyDescription, Reser_id
    ], (err, historyResult) => {
      if (err) {
        console.error('Error inserting history:', err);
        return res.status(500).json({ success: false, message: 'History insert error', data: null });
      }

      // อัปเดต user_score
      connection.query(updateUserScoreQuery, [earnedScore, earnedScore, User_id], (err, updateResult) => {
        if (err) {
          console.error('Error updating user score:', err);
          return res.status(500).json({ success: false, message: 'User score update error', data: null });
        }

        res.json({
          success: true,
          message: 'Review score earned successfully',
          data: {
            earned_score: earnedScore,
            review_point: review_point
          }
        });
      });
    });
  });
});

// API ดึงประวัติแต้ม
router.get('/history/:userId', (req, res) => {
  const userId = req.params.userId;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const query = `
    SELECT
      sh.History_id,
      sh.Score_amount,
      sh.Score_type,
      sh.Score_source,
      sh.Score_description,
      sh.Created_at,
      sh.Payment_id,
      sh.Reser_id
    FROM score_history sh
    WHERE sh.User_id = ?
    ORDER BY sh.Created_at DESC
    LIMIT ? OFFSET ?
  `;

  connection.query(query, [userId, parseInt(limit), offset], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', data: null });

    res.json({
      success: true,
      message: 'Score history retrieved',
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        offset: offset
      }
    });
  });
});

// API ดึงรายการ rewards ทั้งหมด (สำหรับ admin)
router.get('/rewards', (req, res) => {
  const query = 'SELECT * FROM score_rewards ORDER BY Reward_id ASC';

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching rewards:', err);
      return res.status(500).json({ success: false, message: 'Database error', data: null });
    }

    res.json({
      success: true,
      message: 'Rewards fetched successfully',
      data: results
    });
  });
});

// API ดึงรายการรางวัลที่แลกได้ (สำหรับ user - active เท่านั้น)
router.get('/rewards/active', (req, res) => {
  const query = `
    SELECT
      Reward_id,
      Reward_name,
      Reward_description,
      Score_required,
      Discount_amount,
      Discount_percentage,
      Is_active
    FROM score_rewards
    WHERE Is_active = TRUE
    ORDER BY Score_required ASC
  `;

  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', data: null });

    res.json({
      success: true,
      message: 'Rewards retrieved',
      data: results
    });
  });
});

// API ดึง reward ตาม ID
router.get('/rewards/:id', (req, res) => {
  const rewardId = req.params.id;
  const query = 'SELECT * FROM score_rewards WHERE Reward_id = ?';

  connection.query(query, [rewardId], (err, results) => {
    if (err) {
      console.error('Error fetching reward:', err);
      return res.status(500).json({ success: false, message: 'Database error', data: null });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Reward not found', data: null });
    }

    res.json({
      success: true,
      message: 'Reward fetched successfully',
      data: results[0]
    });
  });
});

// API เพิ่ม reward ใหม่
router.post('/rewards', (req, res) => {
  const { Reward_name, Reward_description, Score_required, Discount_amount, Discount_percentage, Is_active = 1 } = req.body;

  if (!Reward_name || !Score_required || !Discount_amount) {
    return res.status(400).json({ success: false, message: 'Missing required fields', data: null });
  }

  const query = `
    INSERT INTO score_rewards (
      Reward_name, Reward_description, Score_required,
      Discount_amount, Discount_percentage, Is_active
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;

  connection.query(query, [
    Reward_name, Reward_description, Score_required,
    Discount_amount, Discount_percentage, Is_active
  ], (err, result) => {
    if (err) {
      console.error('Error creating reward:', err);
      return res.status(500).json({ success: false, message: 'Database error', data: null });
    }

    res.json({
      success: true,
      message: 'Reward created successfully',
      data: {
        Reward_id: result.insertId,
        Reward_name,
        Reward_description,
        Score_required,
        Discount_amount,
        Discount_percentage,
        Is_active
      }
    });
  });
});

// API อัปเดต reward
router.put('/rewards/:id', (req, res) => {
  const rewardId = req.params.id;
  const { Reward_name, Reward_description, Score_required, Discount_amount, Discount_percentage, Is_active } = req.body;

  const query = `
    UPDATE score_rewards
    SET Reward_name = ?, Reward_description = ?, Score_required = ?,
        Discount_amount = ?, Discount_percentage = ?, Is_active = ?
    WHERE Reward_id = ?
  `;

  connection.query(query, [
    Reward_name, Reward_description, Score_required,
    Discount_amount, Discount_percentage, Is_active, rewardId
  ], (err, result) => {
    if (err) {
      console.error('Error updating reward:', err);
      return res.status(500).json({ success: false, message: 'Database error', data: null });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Reward not found', data: null });
    }

    res.json({
      success: true,
      message: 'Reward updated successfully',
      data: {
        Reward_id: rewardId,
        Reward_name,
        Reward_description,
        Score_required,
        Discount_amount,
        Discount_percentage,
        Is_active
      }
    });
  });
});

// API ลบ reward
router.delete('/rewards/:id', (req, res) => {
  const rewardId = req.params.id;
  const query = 'DELETE FROM score_rewards WHERE Reward_id = ?';

  connection.query(query, [rewardId], (err, result) => {
    if (err) {
      console.error('Error deleting reward:', err);
      return res.status(500).json({ success: false, message: 'Database error', data: null });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Reward not found', data: null });
    }

    res.json({
      success: true,
      message: 'Reward deleted successfully',
      data: null
    });
  });
});

// API แลกแต้ม
router.post('/redeem', (req, res) => {
  const { User_id, Reward_id, Payment_id, Reser_id } = req.body;

  if (!User_id || !Reward_id) {
    return res.status(400).json({ success: false, message: 'User_id and Reward_id are required' });
  }

  // ตรวจสอบรางวัลและแต้มของผู้ใช้
  const checkQuery = `
    SELECT
      sr.Reward_id,
      sr.Reward_name,
      sr.Score_required,
      sr.Discount_amount,
      sr.Discount_percentage,
      us.Current_balance
    FROM score_rewards sr
    CROSS JOIN user_score us
    WHERE sr.Reward_id = ? AND us.User_id = ? AND sr.Is_active = TRUE
  `;

  connection.query(checkQuery, [Reward_id, User_id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', data: null });

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Reward not found or user not found', data: null });
    }

    const reward = results[0];

    if (reward.Current_balance < reward.Score_required) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient score balance',
        data: {
          required: reward.Score_required,
          current: reward.Current_balance
        }
      });
    }

    // ใช้แต้ม
    const usedScore = reward.Score_required;

    // เพิ่มข้อมูลในตาราง score
    const scoreQuery = `
      INSERT INTO score (
        Score_detail, Score_total, Score_earned, Score_used, Score_balance,
        Score_type, Score_source, Payment_id, Reser_id, User_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // เพิ่มข้อมูลในตาราง score_history
    const historyQuery = `
      INSERT INTO score_history (
        User_id, Score_amount, Score_type, Score_source, Score_description,
        Payment_id, Reser_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // อัปเดต user_score
    const updateUserScoreQuery = `
      UPDATE user_score
      SET Total_used = Total_used + ?, Current_balance = Current_balance - ?, Last_updated = NOW()
      WHERE User_id = ?
    `;

    // ใช้ Promise-based approach แทน transaction
    const scoreDetail = `ใช้แต้มแลก${reward.Reward_name}`;
    const historyDescription = `ใช้ ${usedScore} แต้มแลก${reward.Reward_name}`;

    // เพิ่ม score record
    connection.query(scoreQuery, [
      scoreDetail, usedScore.toString(), 0, usedScore, -usedScore,
      'use', 'reward', Payment_id, Reser_id, User_id
    ], (err, scoreResult) => {
      if (err) {
        console.error('Error inserting score:', err);
        return res.status(500).json({ success: false, message: 'Score insert error', data: null });
      }

      // เพิ่ม history record
      connection.query(historyQuery, [
        User_id, usedScore, 'use', 'reward', historyDescription, Payment_id, Reser_id
      ], (err, historyResult) => {
        if (err) {
          console.error('Error inserting history:', err);
          return res.status(500).json({ success: false, message: 'History insert error', data: null });
        }

        // อัปเดต user_score
        connection.query(updateUserScoreQuery, [usedScore, usedScore, User_id], (err, updateResult) => {
          if (err) {
            console.error('Error updating user score:', err);
            return res.status(500).json({ success: false, message: 'User score update error', data: null });
          }

          res.json({
            success: true,
            message: 'Score redeemed successfully',
            data: {
              reward_name: reward.Reward_name,
              used_score: usedScore,
              discount_amount: reward.Discount_amount,
              discount_percentage: reward.Discount_percentage,
              remaining_balance: reward.Current_balance - usedScore
            }
          });
        });
      });
    });
  });
});

module.exports = router;
