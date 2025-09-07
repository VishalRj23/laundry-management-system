const express = require("express");
const router = express.Router();
const db = require("../db"); // MySQL connection

// -------------------
// 1. Add Clothes Record
// -------------------
router.post("/give", async (req, res) => {
  try {
    const { name, floor, page_no, tshirt, shirt, pant, bedsheet, total } = req.body;

    console.log("📥 Received /give payload:", req.body);

    // normalize name for lookup (trim + lowercase) to avoid simple mismatch issues
    const nameNormalized = typeof name === "string" ? name.trim() : "";

    // Step 1: Get student_id (must exist in Students)
    // Use LOWER(TRIM(name)) to make lookup more forgiving with whitespace/case.
    const [student] = await db.promise().query(
      "SELECT student_id, name, floor_no, page_no FROM Students WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND floor_no = ? AND page_no = ?",
      [nameNormalized, floor, page_no]
    );

    console.log("🔎 student rows:", student);

    if (!student[0]) {
      return res.status(404).json({
        message: "Student not found! Please register first.",
        searched: { name: nameNormalized, floor, page_no },
        found: student,
      });
    }

    const studentId = student[0].student_id;

    // Step 2: Insert laundry record
    const [result] = await db.promise().query(
      "INSERT INTO Laundry_Records (student_id, date_given, total_clothes, is_collected) VALUES (?, CURDATE(), ?, FALSE)",
      [studentId, total]
    );

    const recordId = result.insertId;

    // Step 3: Insert breakdown into Laundry_Record_Details
    const items = [
      { item_id: 1, quantity: tshirt },
      { item_id: 2, quantity: shirt },
      { item_id: 3, quantity: pant },
      { item_id: 4, quantity: bedsheet },
    ];

    const values = items
      .filter(i => Number(i.quantity) > 0) // only insert if > 0
      .map(i => [recordId, i.item_id, i.quantity]);

    if (values.length > 0) {
      await db.promise().query(
        "INSERT INTO Laundry_Record_Details (record_id, item_id, quantity) VALUES ?",
        [values]
      );
    }

    res.json({ message: "Clothes submitted successfully!", recordId });
  } catch (err) {
    console.error("❌ Error in /give:", err);
    res.status(500).json({ message: "Error adding clothes record.", error: err });
  }
});

// -------------------
// 2. Get Last Laundry Record
// -------------------
router.get("/last/:floor/:pageNo", async (req, res) => {
  try {
    const { floor, pageNo } = req.params;

    // Step 1: Get student_id
    const [student] = await db.promise().query(
      "SELECT student_id, name FROM Students WHERE floor_no = ? AND page_no = ?",
      [floor, pageNo]
    );

    if (!student[0]) {
      return res.status(404).json({ message: "Student not found!" });
    }

    const studentId = student[0].student_id;
    const name = student[0].name;

    // Step 2: Get last laundry record
    const [records] = await db.promise().query(
      "SELECT record_id, date_given, total_clothes, is_collected FROM Laundry_Records WHERE student_id = ? ORDER BY record_id DESC LIMIT 1",
      [studentId]
    );

    if (!records[0]) return res.json(null);

    const rec = records[0];

    // Step 3: Get record details (quantities per item)
    const [details] = await db.promise().query(
      "SELECT item_id, quantity FROM Laundry_Record_Details WHERE record_id = ?",
      [rec.record_id]
    );

    // Map item_id -> field
    const map = { 1: 'tshirt', 2: 'shirt', 3: 'pant', 4: 'bedsheet' };
    const breakdown = { tshirt: 0, shirt: 0, pant: 0, bedsheet: 0 };
    for (const d of details) {
      const key = map[d.item_id];
      if (key) breakdown[key] = Number(d.quantity);
    }

    const lastRecord = {
      record_id: rec.record_id,
      name,
      floor: Number(floor),
      page_no: Number(pageNo),
      given_date: rec.date_given instanceof Date ? rec.date_given.toISOString().split('T')[0] : rec.date_given,
      total: rec.total_clothes,
      confirmed: Boolean(rec.is_collected),
      ...breakdown,
    };

    res.json(lastRecord);
  } catch (err) {
    console.error("❌ Error in /last:", err);
    res.status(500).json({ message: "Error fetching last record.", error: err });
  }
});

// -------------------
// 3. Confirm Collection
// -------------------
router.put("/confirm/:recordId", async (req, res) => {
  try {
    const { recordId } = req.params;

    const [result] = await db.promise().query(
      "UPDATE Laundry_Records SET is_collected = TRUE WHERE record_id = ?",
      [recordId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Record not found!" });
    }

  // return updated status
  res.json({ message: "Collection confirmed!", recordId: Number(recordId), confirmed: true });
  } catch (err) {
    console.error("❌ Error in /confirm:", err);
    res.status(500).json({ message: "Error confirming collection.", error: err });
  }
});

module.exports = router;

// --- Helper: create test student (useful during development)
// POST /api/students/register { name, floor_no, page_no }
router.post("/students/register", async (req, res) => {
  try {
    const { name, floor_no, page_no } = req.body;
    if (!name || !floor_no || !page_no) {
      return res.status(400).json({ message: "Missing name, floor_no or page_no" });
    }

    const [result] = await db.promise().query(
      "INSERT INTO Students (name, floor_no, page_no) VALUES (?, ?, ?)",
      [name.trim(), floor_no, page_no]
    );

    res.json({ message: "Student registered", studentId: result.insertId });
  } catch (err) {
    console.error("❌ Error in /students/register:", err);
    res.status(500).json({ message: "Error registering student.", error: err });
  }
});

// Debug: search students
// GET /api/students/search?name=foo&floor=1&page=2
router.get("/students/search", async (req, res) => {
  try {
    const { name, floor, page } = req.query;
    const nameNormalized = name ? name.trim() : "";
    const [rows] = await db.promise().query(
      "SELECT student_id, name, floor_no, page_no FROM Students WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND floor_no = ? AND page_no = ?",
      [nameNormalized, floor, page]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Error in /students/search:", err);
    res.status(500).json({ message: "Error searching students.", error: err });
  }
});
