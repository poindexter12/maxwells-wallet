from typing import List, Dict, Tuple
import re

# Default categories with keyword patterns
CATEGORY_PATTERNS = {
    'Income': [
        'payroll', 'salary', 'deposit', 'haemonetics', 'income', 'refund',
        'reimbursement', 'payment received'
    ],
    'Groceries': [
        'grocery', 'supermarket', 'trader joe', 'whole foods', 'sprouts',
        'ralphs', 'vons', 'safeway', 'kroger', 'albertsons', 'costco', 'sam\'s club'
    ],
    'Dining & Coffee': [
        'restaurant', 'starbucks', 'coffee', 'cafe', 'pizza', 'chipotle',
        'mcdonald', 'burger', 'taco', 'subway', 'domino', 'doordash',
        'uber eats', 'grubhub', 'bar', 'brewery', 'bistro', 'grill'
    ],
    'Shopping': [
        'amazon', 'target', 'walmart', 'ebay', 'etsy', 'mall', 'store',
        'retail', 'merchandise', 'shopping', 'purchase', 'clothing',
        'apparel', 'wholesale'
    ],
    'Utilities': [
        'electric', 'gas', 'water', 'internet', 'cable', 'phone', 'mobile',
        't-mobile', 'verizon', 'at&t', 'sprint', 'sdge', 'sd gas', 'utility',
        'ting internet', 'comcast', 'spectrum'
    ],
    'Transportation': [
        'gas station', 'chevron', 'shell', 'arco', 'mobil', 'exxon',
        'uber', 'lyft', 'taxi', 'toll', 'parking', 'dmv', 'auto',
        'the toll roads'
    ],
    'Entertainment': [
        'netflix', 'hulu', 'disney', 'spotify', 'apple music', 'movie',
        'theater', 'cinema', 'concert', 'tickets', 'entertainment',
        'game', 'playstation', 'xbox', 'steam'
    ],
    'Healthcare': [
        'pharmacy', 'cvs', 'walgreens', 'doctor', 'medical', 'dental',
        'dentist', 'orthodont', 'hospital', 'clinic', 'health', 'care',
        'yoshikane', 'vet', 'veterinary'
    ],
    'Education': [
        'school', 'tuition', 'college', 'university', 'education',
        'training', 'course', 'class', 'martial arts', 'gymnastics',
        'teamsnap'
    ],
    'Housing': [
        'rent', 'mortgage', 'hoa', 'association', 'dues', 'property',
        'rancho ponderosa', 'lease', 'housing'
    ],
    'Subscriptions': [
        'subscription', 'membership', 'monthly', 'annual', 'microsoft',
        'apple', 'google', 'github', 'dropbox', 'icloud', 'chatgpt',
        'openai', 'newshosting'
    ],
}

def normalize_text(text: str) -> str:
    """Normalize text for matching"""
    return re.sub(r'[^a-z0-9\s]', '', text.lower())

def infer_category(merchant: str, description: str,
                  amount: float, user_history: Dict[str, str] = None) -> List[Tuple[str, float]]:
    """
    Infer category for a transaction

    Args:
        merchant: Merchant name
        description: Transaction description
        amount: Transaction amount
        user_history: Optional dict of merchant -> category from user's past categorizations

    Returns:
        List of (category, confidence) tuples, sorted by confidence (max 3)
    """
    # Check user history first (highest confidence)
    if user_history and merchant in user_history:
        return [(user_history[merchant], 1.0)]

    # Combine merchant and description for matching
    search_text = normalize_text(f"{merchant} {description}")

    # Income detection: positive amount
    if amount > 0:
        return [('Income', 0.9)]

    # Score each category
    scores = {}
    for category, keywords in CATEGORY_PATTERNS.items():
        score = 0.0
        for keyword in keywords:
            if normalize_text(keyword) in search_text:
                # Higher score for exact merchant match
                if normalize_text(keyword) in normalize_text(merchant):
                    score += 0.5
                else:
                    score += 0.3

        if score > 0:
            scores[category] = min(score, 1.0)  # Cap at 1.0

    # Sort by score and return top 3
    if not scores:
        return [('Other', 0.1)]

    sorted_categories = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_categories[:3]

def build_user_history(transactions: List) -> Dict[str, str]:
    """
    Build merchant -> category mapping from user's categorized transactions

    Args:
        transactions: List of Transaction objects with merchant and category

    Returns:
        Dict mapping merchant to most common category
    """
    merchant_categories = {}
    for txn in transactions:
        if txn.merchant and txn.category and txn.category != 'Other':
            merchant = txn.merchant.lower()
            if merchant not in merchant_categories:
                merchant_categories[merchant] = {}

            if txn.category not in merchant_categories[merchant]:
                merchant_categories[merchant][txn.category] = 0
            merchant_categories[merchant][txn.category] += 1

    # Pick most common category for each merchant
    user_history = {}
    for merchant, categories in merchant_categories.items():
        most_common = max(categories.items(), key=lambda x: x[1])
        user_history[merchant] = most_common[0]

    return user_history
