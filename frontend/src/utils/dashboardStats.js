/**
 * Utility functions for user safety dashboard statistics and estimated fraud prevention savings.
 */

/**
 * Calculates estimated fraud money saved based on detected fee amounts or realistic industry averages
 */
export function calculateEstimatedMoneySaved(history) {
  if (!Array.isArray(history) || history.length === 0) return 0;
  
  return history.reduce((total, item) => {
    // Only scam / suspicious offers represent saved fraud money
    if (item.riskLevel !== 'high' && item.riskLevel !== 'medium') return total;
    
    const text = item.text || item.submittedText || '';
    
    // Look for explicit fee/deposit numbers like "2000", "2,450", "₹5000", "INR 10,000", "Pay 2000"
    const matches = text.match(/\b(?:rs\.?|inr|₹|pay|fee|deposit|clearance)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,6})\b/gi);
    if (matches && matches.length > 0) {
      for (const m of matches) {
        const digits = m.replace(/[^0-9]/g, '');
        const num = parseInt(digits, 10);
        if (!isNaN(num) && num >= 500 && num <= 100000) {
          return total + num;
        }
      }
    }
    // Realistic average Indian job recruitment fee scam loss prevented per incident
    return total + 3500;
  }, 0);
}
