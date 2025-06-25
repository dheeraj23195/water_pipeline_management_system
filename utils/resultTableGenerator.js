// Function to generate HTML table from query results
function generateResultTable(data, queryTitle) {
    // If no data or empty array
    if (!data || data.length === 0) {
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${queryTitle} Results</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #e9f5ec;
              padding: 40px;
              margin: 0;
            }
            
            .result-container {
              background-color: #ffffff;
              padding: 40px;
              border-radius: 16px;
              max-width: 90%;
              margin: auto;
              box-shadow: 0 8px 24px rgba(0, 128, 0, 0.1);
            }
            
            h3 {
              text-align: center;
              color: #2f7a44;
              margin-bottom: 30px;
              font-size: 24px;
            }
            
            .message {
              text-align: center;
              color: #666;
              padding: 20px;
              font-size: 18px;
            }
            
            .back-button {
              background-color: #4caf50;
              color: #ffffff;
              padding: 12px 24px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              display: block;
              margin: 30px auto 0;
              text-decoration: none;
              text-align: center;
              max-width: 200px;
            }
            
            .back-button:hover {
              background-color: #388e3c;
              box-shadow: 0 4px 12px rgba(56, 142, 60, 0.3);
            }
          </style>
        </head>
        <body>
          <div class="result-container">
            <h3>${queryTitle} Results</h3>
            <div class="message">No results found.</div>
            <a href="javascript:history.back()" class="back-button">Back to Query</a>
          </div>
        </body>
        </html>
      `;
    }
  
    // Get column names from the first row
    const columns = Object.keys(data[0]);
  
    // Generate table HTML
    let tableHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${queryTitle} Results</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #e9f5ec;
            padding: 40px;
            margin: 0;
          }
          
          .result-container {
            background-color: #ffffff;
            padding: 40px;
            border-radius: 16px;
            max-width: 90%;
            margin: auto;
            box-shadow: 0 8px 24px rgba(0, 128, 0, 0.1);
            overflow-x: auto;
          }
          
          h3 {
            text-align: center;
            color: #2f7a44;
            margin-bottom: 30px;
            font-size: 24px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
          }
          
          th {
            background-color: #4caf50;
            color: white;
            font-weight: bold;
            padding: 12px 15px;
            text-align: left;
            font-size: 16px;
          }
          
          td {
            padding: 12px 15px;
            font-size: 15px;
            border-bottom: 1px solid #dddddd;
          }
          
          tr:nth-child(even) {
            background-color: #f7fcf8;
          }
          
          tr:hover {
            background-color: #e8f5e9;
          }
          
          tr:last-child td {
            border-bottom: none;
          }
          
          .back-button {
            background-color: #4caf50;
            color: #ffffff;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            display: block;
            margin: 0 auto;
            text-decoration: none;
            text-align: center;
            max-width: 200px;
          }
          
          .back-button:hover {
            background-color: #388e3c;
            box-shadow: 0 4px 12px rgba(56, 142, 60, 0.3);
          }
        </style>
      </head>
      <body>
        <div class="result-container">
          <h3>${queryTitle} Results</h3>
          <table>
            <thead>
              <tr>
    `;
  
    // Add table headers
    columns.forEach(column => {
      // Convert snake_case to Title Case
      const formattedColumn = column
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      tableHTML += `<th>${formattedColumn}</th>`;
    });
  
    tableHTML += `
              </tr>
            </thead>
            <tbody>
    `;
  
    // Add table rows
    data.forEach(row => {
      tableHTML += '<tr>';
      columns.forEach(column => {
        // Format null values and special formatting for monetary values
        let cellValue = row[column];
        
        if (cellValue === null) {
          cellValue = '-';
        } else if (
          column.includes('amount') || 
          column.includes('due') || 
          column.includes('revenue') ||
          column.includes('paid')
        ) {
          // Format as currency if it's a number
          if (!isNaN(cellValue)) {
            cellValue = '$' + parseFloat(cellValue).toFixed(2);
          }
        } else if (
          column.includes('percentage') && 
          !isNaN(cellValue)
        ) {
          // Format as percentage
          cellValue = parseFloat(cellValue).toFixed(2) + '%';
        }
        
        tableHTML += `<td>${cellValue}</td>`;
      });
      tableHTML += '</tr>';
    });
  
    tableHTML += `
            </tbody>
          </table>
          <a href="javascript:history.back()" class="back-button">Back to Query</a>
        </div>
      </body>
      </html>
    `;
  
    return tableHTML;
  }
  
  module.exports = generateResultTable;