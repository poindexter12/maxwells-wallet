from typing import List, Dict, Tuple
import re

# Default bucket tag patterns - maps bucket value to keyword patterns
BUCKET_PATTERNS = {
    'income': [
        'payroll', 'salary', 'deposit', 'haemonetics', 'income', 'refund',
        'reimbursement', 'payment received'
    ],
    'groceries': [
        'grocery', 'supermarket', 'trader joe', 'whole foods', 'sprouts',
        'ralphs', 'vons', 'safeway', 'kroger', 'albertsons', 'costco', 'sam\'s club'
    ],
    'dining': [
        'restaurant', 'starbucks', 'coffee', 'cafe', 'pizza', 'chipotle',
        'mcdonald', 'burger', 'taco', 'subway', 'domino', 'doordash',
        'uber eats', 'grubhub', 'bar', 'brewery', 'bistro', 'grill'
    ],
    'shopping': [
        'amazon', 'target', 'walmart', 'ebay', 'etsy', 'mall', 'store',
        'retail', 'merchandise', 'shopping', 'purchase', 'clothing',
        'apparel', 'wholesale'
    ],
    'utilities': [
        'electric', 'gas', 'water', 'internet', 'cable', 'phone', 'mobile',
        't-mobile', 'verizon', 'at&t', 'sprint', 'sdge', 'sd gas', 'utility',
        'ting internet', 'comcast', 'spectrum'
    ],
    'transportation': [
        'gas station', 'chevron', 'shell', 'arco', 'mobil', 'exxon',
        'uber', 'lyft', 'taxi', 'toll', 'parking', 'dmv', 'auto',
        'the toll roads'
    ],
    'entertainment': [
        'netflix', 'hulu', 'disney', 'spotify', 'apple music', 'movie',
        'theater', 'cinema', 'concert', 'tickets', 'entertainment',
        'game', 'playstation', 'xbox', 'steam'
    ],
    'healthcare': [
        'pharmacy', 'cvs', 'walgreens', 'doctor', 'medical', 'dental',
        'dentist', 'orthodont', 'hospital', 'clinic', 'health', 'care',
        'yoshikane', 'vet', 'veterinary'
    ],
    'education': [
        'school', 'tuition', 'college', 'university', 'education',
        'training', 'course', 'class', 'martial arts', 'gymnastics',
        'teamsnap'
    ],
    'housing': [
        'rent', 'mortgage', 'hoa', 'association', 'dues', 'property',
        'rancho ponderosa', 'lease', 'housing'
    ],
    'subscriptions': [
        'subscription', 'membership', 'monthly', 'annual', 'microsoft',
        'apple', 'google', 'github', 'dropbox', 'icloud', 'chatgpt',
        'openai', 'newshosting'
    ],
}


def normalize_text(text: str) -> str:
    """Normalize text for matching"""
    return re.sub(r'[^a-z0-9\s]', '', text.lower())


def infer_bucket_tag(
    merchant: str,
    description: str,
    amount: float,
    user_history: Dict[str, str] = None
) -> List[Tuple[str, float]]:
    """
    Infer bucket tag for a transaction

    Args:
        merchant: Merchant name
        description: Transaction description
        amount: Transaction amount
        user_history: Optional dict of merchant -> bucket tag from user's past categorizations

    Returns:
        List of (tag, confidence) tuples, sorted by confidence (max 3)
        Tags are in full format: "bucket:value"
    """
    # Check user history first (highest confidence)
    if user_history and merchant and merchant.lower() in user_history:
        return [(user_history[merchant.lower()], 1.0)]

    # Combine merchant and description for matching
    search_text = normalize_text(f"{merchant or ''} {description or ''}")

    # Income detection: positive amount
    if amount > 0:
        return [('bucket:income', 0.9)]

    # Score each bucket
    scores = {}
    for bucket_value, keywords in BUCKET_PATTERNS.items():
        score = 0.0
        for keyword in keywords:
            if normalize_text(keyword) in search_text:
                # Higher score for exact merchant match
                if merchant and normalize_text(keyword) in normalize_text(merchant):
                    score += 0.5
                else:
                    score += 0.3

        if score > 0:
            tag = f"bucket:{bucket_value}"
            scores[tag] = min(score, 1.0)  # Cap at 1.0

    # Sort by score and return top 3
    if not scores:
        return [('bucket:none', 0.1)]

    sorted_tags = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_tags[:3]
