const express = require("express");
const router = express.Router();
const db = require("../db/db");
const path = require("path");
const generateResultTable = require("../utils/resultTableGenerator");

// Serve the form HTML files from public/forms directory
router.get("/forms/:formName", (req, res) => {
  const formName = req.params.formName;
  res.sendFile(path.join(__dirname, `../public/forms/${formName}`));
});

router.post("/query1", async (req, res) => {
  const fields = Array.isArray(req.body.fields)
    ? req.body.fields
    : [req.body.fields];
  const selectFields = fields.join(", ");

  const sql = `
    SELECT ${selectFields}
    FROM Billing b
    JOIN Colonies c ON b.colony_id = c.colony_id
    JOIN Sectors s ON c.sector_id = s.sector_id
    JOIN Company com ON s.company_id = com.company_id
    JOIN Billing_Cycles bc ON b.cycle_id = bc.cycle_id
    ORDER BY bc.year, bc.quarter, com.company_name
  `;

  try {
    const result = await db.query(sql);
    
    // Generate HTML table
    const html = generateResultTable(result.rows, "Billing Details");
    
    // Send HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send(`
      <html>
        <head>
          <title>Error</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #e9f5ec;
              padding: 40px;
              text-align: center;
            }
            .error-container {
              background-color: #ffffff;
              padding: 40px;
              border-radius: 16px;
              max-width: 650px;
              margin: auto;
              box-shadow: 0 8px 24px rgba(0, 128, 0, 0.1);
            }
            h3 {
              color: #e53935;
              margin-bottom: 20px;
            }
            .error-message {
              color: #666;
              margin-bottom: 30px;
            }
            .back-button {
              background-color: #4caf50;
              color: #ffffff;
              padding: 12px 24px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              display: inline-block;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h3>Query Error</h3>
            <div class="error-message">Query error: ${err.message}</div>
            <a href="javascript:history.back()" class="back-button">Back to Form</a>
          </div>
        </body>
      </html>
    `);
  }
});

router.post("/query2", async (req, res) => {
  let companies = req.body.company_name;

  // Ensure companies is an array (in case only one company is selected)
  if (!Array.isArray(companies)) {
    companies = [companies];
  }

  // Dynamically create placeholders like $1, $2, ...
  const placeholders = companies.map((_, i) => `$${i + 1}`).join(", ");

  const sql = `
    SELECT c.company_id, c.company_name, bc.year, bc.quarter, 
           SUM(b.amount_paid) AS total_collected,
           SUM(b.total_due) AS total_billed,
           ROUND((SUM(b.amount_paid) / SUM(b.total_due)) * 100, 2) AS collection_percentage
    FROM Billing b
    JOIN Colonies col ON b.colony_id = col.colony_id
    JOIN Sectors s ON col.sector_id = s.sector_id
    JOIN Company c ON s.company_id = c.company_id
    JOIN Billing_Cycles bc ON b.cycle_id = bc.cycle_id
    WHERE c.company_name IN (${placeholders})
    GROUP BY c.company_id, c.company_name, bc.year, bc.quarter
    ORDER BY bc.year, bc.quarter, c.company_name;
  `;

  try {
    const result = await db.query(sql, companies);
    const html = generateResultTable(result.rows, "Company Billing Summary");
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query error");
  }
});

router.post("/query3", async (req, res) => {
  const { comparison } = req.body;

  // Validate input
  if (!["higher", "lower"].includes(comparison)) {
    return res.status(400).send("Invalid comparison type");
  }

  const operator = comparison === "higher" ? ">" : "<";

  const sql = `
    SELECT c.colony_id, c.colony_name, s.sector_name, 
           AVG(b.base_amount) AS avg_bill_amount
    FROM Colonies c
    JOIN Sectors s ON c.sector_id = s.sector_id
    JOIN Billing b ON c.colony_id = b.colony_id
    GROUP BY c.colony_id, c.colony_name, s.sector_name
    HAVING AVG(b.base_amount) ${operator} (
      SELECT AVG(base_amount) FROM Billing
    )
    ORDER BY avg_bill_amount DESC;
  `;

  try {
    const result = await db.query(sql);
    const html = generateResultTable(result.rows, `Colonies with ${comparison.charAt(0).toUpperCase() + comparison.slice(1)} Than Average Bills`);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query error");
  }
});

router.post("/query4", async (req, res) => {
  const companies = Array.isArray(req.body.company_name)
    ? req.body.company_name
    : [req.body.company_name];

  console.log("Selected Companies:", companies); // Debug

  const sql = `
    SELECT s.sector_id, s.sector_name, c.company_name
    FROM Sectors s
    JOIN Company c ON s.company_id = c.company_id
    JOIN Colonies col ON s.sector_id = col.sector_id
    LEFT JOIN Complaints comp ON col.colony_id = comp.colony_id
    WHERE c.company_name = ANY($1)
    GROUP BY s.sector_id, s.sector_name, c.company_name
    HAVING COUNT(DISTINCT col.colony_id) = COUNT(DISTINCT comp.colony_id);
  `;

  try {
    const result = await db.query(sql, [`{${companies.join(',')}}`]);
    const html = generateResultTable(result.rows, "Sectors with Complaints from All Colonies");
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error("Query Error:", err);
    res.status(500).send("Database query error");
  }
});

router.post("/query5", async (req, res) => {
  const { company_name, sector_name } = req.body;

  const sql = `
    SELECT c.company_id, c.company_name, s.sector_id, s.sector_name, 
           COUNT(col.colony_id) AS colony_count
    FROM Company c
    JOIN Sectors s ON c.company_id = s.company_id
    LEFT JOIN Colonies col ON s.sector_id = col.sector_id
    WHERE c.company_name = $1 AND s.sector_name = $2
    GROUP BY c.company_id, c.company_name, s.sector_id, s.sector_name
    ORDER BY c.company_name, colony_count DESC;
  `;

  try {
    const result = await db.query(sql, [company_name, sector_name]);
    const html = generateResultTable(result.rows, `Colony Count for ${company_name} - ${sector_name}`);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query error");
  }
});

router.post("/query6", async (req, res) => {
  const { year, quarter } = req.body;

  // Determine the last date of the selected quarter
  const quarterEndMap = {
    1: "-03-31",
    2: "-06-30",
    3: "-09-30",
    4: "-12-31",
  };

  const endDate = `${year}${quarterEndMap[quarter]}`;

  const sql = `
    SELECT 
      c.colony_id, 
      c.colony_name, 
      s.sector_name, 
      comp.company_name
    FROM Colonies c
    JOIN Sectors s ON c.sector_id = s.sector_id
    JOIN Company comp ON s.company_id = comp.company_id
    LEFT JOIN Billing b ON c.colony_id = b.colony_id
    LEFT JOIN Billing_Cycles bc ON b.cycle_id = bc.cycle_id
      AND bc.end_date <= $1
      AND b.status <> 'Paid'
    WHERE b.bill_id IS NULL
    GROUP BY c.colony_id, c.colony_name, s.sector_name, comp.company_name;
  `;

  try {
    const result = await db.query(sql, [endDate]);
    const html = generateResultTable(result.rows, `Colonies with No Unpaid Bills as of Q${quarter} ${year}`);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error executing query");
  }
});

router.post("/query7", async (req, res) => {
  const { ranking } = req.body;

  const sql = `
    SELECT 
      c.company_id, 
      c.company_name, 
      COUNT(s.sector_id) AS sector_count
    FROM Company c
    JOIN Sectors s ON c.company_id = s.company_id
    GROUP BY c.company_id, c.company_name
    ORDER BY sector_count DESC
    LIMIT $1;
  `;

  try {
    const result = await db.query(sql, [ranking]);
    const html = generateResultTable(result.rows, `Top ${ranking} Companies by Sector Count`);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error executing query");
  }
});

router.post("/query8", async (req, res) => {
  const { cycle_id } = req.body;

  const sql = `
    SELECT bc.cycle_id, SUM(b.amount_paid) AS total_revenue
    FROM Billing b
    JOIN Billing_Cycles bc ON b.cycle_id = bc.cycle_id
    WHERE bc.cycle_id = $1
    GROUP BY bc.cycle_id
  `;

  try {
    const result = await db.query(sql, [cycle_id]);
    const html = generateResultTable(result.rows, `Revenue for Billing Cycle ${cycle_id}`);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Query 8 failed");
  }
});

router.post("/query9", async (req, res) => {
  let { colonies } = req.body;

  // Ensure colonies is an array even when one is selected
  if (!Array.isArray(colonies)) {
    colonies = [colonies];
  }

  const sql = `
    SELECT b.cycle_id, col.colony_name, COUNT(b.bill_id) AS total_bills_paid,
           SUM(b.amount_paid) / COUNT(b.bill_id) AS avg_amount_per_bill
    FROM Billing b
    JOIN Colonies col ON b.colony_id = col.colony_id
    WHERE b.amount_paid > 0 AND col.colony_name = ANY($1)
    GROUP BY b.cycle_id, col.colony_name
    ORDER BY b.cycle_id, col.colony_name;
  `;

  try {
    const result = await db.query(sql, [colonies]);
    const html = generateResultTable(result.rows, "Colony Payment Analysis");
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Query 9 failed");
  }
});

router.post("/query10", async (req, res) => {
  const { days_before_due, amount_threshold } = req.body;

  const sql = `
    SELECT 
      p.payment_id, 
      b.bill_id, 
      bc.due_date, 
      p.payment_date, 
      b.amount_paid
    FROM Payments p
    JOIN Billing b ON p.bill_id = b.bill_id
    JOIN Billing_Cycles bc ON b.cycle_id = bc.cycle_id
    WHERE bc.due_date - p.payment_date >= $1
      AND b.amount_paid >= $2
  `;

  try {
    const result = await db.query(sql, [days_before_due, amount_threshold]);
    const html = generateResultTable(result.rows, `Early Payments (${days_before_due}+ Days Before Due) Above $${amount_threshold}`);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query error");
  }
});

router.post('/submit-complaint', async (req, res) => {
  const { colony_id, complaint_type, description } = req.body;

  try {
    // Get pipeline_id from Colonies table
    const pipelineResult = await db.query(
      'SELECT pipeline_id FROM Colonies WHERE colony_id = $1',
      [colony_id]
    );

    const assigned_pipeline_id =
      pipelineResult.rows.length > 0 ? pipelineResult.rows[0].pipeline_id : null;

    if (!assigned_pipeline_id) {
      return res.status(400).send('<h1>Error</h1><p>No pipeline mapped for this colony.</p>');
    }

    // Insert complaint with all required fields
    const insertResult = await db.query(
      `INSERT INTO Complaints (colony_id, complaint_type, description, date_filed, status, assigned_pipeline_id)
       VALUES ($1, $2, $3, CURRENT_DATE, 'Pending', $4)
       RETURNING *`,
      [colony_id, complaint_type, description, assigned_pipeline_id]
    );

    // Mark colony complaint_flag = true
    await db.query(
      `UPDATE Colonies SET complaint_flag = TRUE WHERE colony_id = $1`,
      [colony_id]
    );

    // Mark sector complaint_flag = true if all its colonies have complaints
    await db.query(
      `UPDATE Sectors
       SET complaint_flag = TRUE
       WHERE sector_id = (
         SELECT sector_id FROM Colonies WHERE colony_id = $1
       )
       AND NOT EXISTS (
         SELECT 1 FROM Colonies c
         WHERE c.sector_id = (
           SELECT sector_id FROM Colonies WHERE colony_id = $1
         )
         AND c.colony_id NOT IN (
           SELECT DISTINCT colony_id FROM Complaints
         )
       )`,
      [colony_id]
    );

    // Render result table
    const html = generateResultTable(insertResult.rows, 'Complaint Submission');
    res.send(html);

  } catch (err) {
    console.error('Error submitting complaint:', err.stack);
    res.status(500).send(`<h1>Error</h1><p>${err.message}</p>`);
  }
});

router.post("/submit-payment", async (req, res) => {
  const { colony_id, year, quarter, amount, payment_method } = req.body;

  try {
    // Get cycle_id from year and quarter
    const cycleResult = await db.query(
      `SELECT cycle_id 
       FROM Billing_Cycles 
       WHERE year = $1 AND quarter = $2`,
      [year, quarter]
    );

    if (cycleResult.rows.length === 0) {
      return res.status(400).send(`
        <html>
          <head>
            <title>Error</title>
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #e9f5ec;
                padding: 40px;
                text-align: center;
              }
              .error-container {
                background-color: #ffffff;
                padding: 40px;
                border-radius: 16px;
                max-width: 650px;
                margin: auto;
                box-shadow: 0 8px 24px rgba(0, 128, 0, 0.1);
              }
              h3 {
                color: #e53935;
                margin-bottom: 20px;
              }
              .error-message {
                color: #666;
                margin-bottom: 30px;
              }
              .back-button {
                background-color: #4caf50;
                color: #ffffff;
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                display: inline-block;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h3>Payment Error</h3>
              <div class="error-message">No billing cycle found for the selected year and quarter.</div>
              <a href="javascript:history.back()" class="back-button">Back to Form</a>
            </div>
          </body>
        </html>
      `);
    }

    const cycle_id = cycleResult.rows[0].cycle_id;
    
    // Check if a bill already exists for this colony and cycle
    const billResult = await db.query(
      `SELECT bill_id, base_amount, previous_due, penalty_amount, total_due, amount_paid 
       FROM Billing 
       WHERE colony_id = $1 AND cycle_id = $2`,
      [colony_id, cycle_id]
    );

    let bill_id;
    let newTotalPaid;
    let billStatus;

    if (billResult.rows.length === 0) {
      // No bill exists, so create one with the payment amount as the base amount
      // This assumes the user is paying the full amount
      const insertBillResult = await db.query(
        `INSERT INTO Billing (colony_id, cycle_id, base_amount, previous_due, penalty_amount, amount_paid, status)
         VALUES ($1, $2, $3, 0, 0, $4, $5)
         RETURNING bill_id, base_amount, previous_due, penalty_amount, total_due, amount_paid`,
        [colony_id, cycle_id, amount, amount, 'Paid']
      );
      
      const newBill = insertBillResult.rows[0];
      bill_id = newBill.bill_id;
      newTotalPaid = parseFloat(newBill.amount_paid);
      billStatus = 'Paid'; // Since we're creating a bill with amount_paid = base_amount
    } else {
      // Bill exists, update it
      const bill = billResult.rows[0];
      bill_id = bill.bill_id;
      newTotalPaid = parseFloat(bill.amount_paid) + parseFloat(amount);
      const totalDue = parseFloat(bill.total_due);
      billStatus = newTotalPaid >= totalDue ? 'Paid' : 'Partially Paid';

      // Update existing bill
      await db.query(
        `UPDATE Billing
         SET amount_paid = $1, 
             status = $2
         WHERE bill_id = $3`,
        [newTotalPaid, billStatus, bill_id]
      );
    }

    // Insert payment record
    const paymentResult = await db.query(
      `INSERT INTO Payments (bill_id, payment_date, amount_paid, payment_method)
       VALUES ($1, CURRENT_DATE, $2, $3)
       RETURNING *`,
      [bill_id, amount, payment_method]
    );

    // Generate result HTML
    const html = generateResultTable(paymentResult.rows, 'Payment Submission');
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send(`
      <html>
        <head>
          <title>Error</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #e9f5ec;
              padding: 40px;
              text-align: center;
            }
            .error-container {
              background-color: #ffffff;
              padding: 40px;
              border-radius: 16px;
              max-width: 650px;
              margin: auto;
              box-shadow: 0 8px 24px rgba(0, 128, 0, 0.1);
            }
            h3 {
              color: #e53935;
              margin-bottom: 20px;
            }
            .error-message {
              color: #666;
              margin-bottom: 30px;
            }
            .back-button {
              background-color: #4caf50;
              color: #ffffff;
              padding: 12px 24px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              display: inline-block;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h3>Payment Error</h3>
            <div class="error-message">Error processing payment: ${err.message}</div>
            <a href="javascript:history.back()" class="back-button">Back to Form</a>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;