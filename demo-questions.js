/**
 * Demo Mode Questions and Pre-written Responses
 * Used for live demonstrations to avoid API delays or network issues
 */

const DEMO_QUESTIONS = [
  {
    id: 'q1',
    question: 'Which weight-loss drug is safer: Zepbound or Wegovy?',
    response: {
      answer: `Based on HundredX human verified data, [Zepbound](https://www.zepbound.com) is rated higher than [Wegovy](https://www.wegovy.com) on safety. This reflects over 500 responses.

**Key insights:**
- Zepbound has safe net favorability of +24% (ranked 1st out of 3).
- Wegovy has safe net favorability of +15% (ranked 2nd out of 3).

**Detailed metrics:**

<details>
<summary>Customer Satisfaction</summary>

- zepbound: 86% satisfaction (ranked 1 out of 3) [over a hundred responses]
- wegovy: 76% satisfaction (ranked 3 out of 3) [over a hundred responses]
- [adipex](https://www.drugs.com/adipex-p.html): 79% satisfaction (ranked 2 out of 3) [over 50 responses]
</details>

<details>
<summary>Driver — Safe</summary>

- zepbound — Safe: +5% (ranked 1 out of 3) — 28% positive, 5% negative [over a hundred responses]
- wegovy — Safe: +-4% (ranked 2 out of 3) — 22% positive, 7% negative [over a hundred responses]
</details>

Source: HundredX customer feedback (T6M ending Jun '25)`,
      success: true,
      error: null,
      _errorType: null,
      metadata: {
        enriched: true,
        intent: 'commercial',
        industry: 'Prescription Medications',
        brands: ['Zepbound', 'Wegovy', 'Adipex']
      },
      sources: [{
        type: 'hundredx',
        name: 'HundredX Customer Experience Data',
        description: 'Based on 500+ customer feedback responses',
        time_period: 'T6M ending Jun \'25',
        confidence: 'high'
      }]
    }
  },

  {
    id: 'q2',
    question: 'Which streaming platforms have the best original content?',
    response: {
      answer: `Based on HundredX human verified data, streaming platforms are ranked as follows for original content quality:

**Top Performers:**
- **Netflix**: 88% satisfaction, ranked #1 for original content depth and variety [over 5,000 responses]
- **Apple TV+**: 85% satisfaction, ranked #2 for high-quality productions [over 1,200 responses]
- **HBO Max**: 84% satisfaction, ranked #3 for prestige content [over 2,800 responses]

**Key Differentiators:**

<details>
<summary>Content Quality Drivers</summary>

- Netflix — Original Content: +42% net favorability — Strong variety across genres
- Apple TV+ — Original Content: +38% net favorability — Cinematic quality, limited catalog
- HBO Max — Original Content: +36% net favorability — Prestige dramas and documentaries
</details>

**Customer Sentiment:**
- Netflix praised for "something for everyone" but concerns about price increases
- Apple TV+ noted for "movie-quality shows" but "needs more content"
- HBO Max appreciated for "Game of Thrones quality" content

Source: HundredX customer feedback (T6M ending Jun '25)`,
      success: true,
      error: null,
      _errorType: null,
      metadata: {
        enriched: true,
        intent: 'commercial',
        industry: 'Streaming Services',
        brands: ['Netflix', 'Apple TV+', 'HBO Max']
      },
      sources: [{
        type: 'hundredx',
        name: 'HundredX Customer Experience Data',
        description: 'Based on 9,000+ customer feedback responses',
        time_period: 'T6M ending Jun \'25',
        confidence: 'high'
      }]
    }
  },

  {
    id: 'q3',
    question: 'How do people rate Coinbase\'s crypto trading platform?',
    response: {
      answer: `Based on HundredX human verified data, **Coinbase** has a GO score of **72** out of 100, ranking 2nd among major crypto exchanges.

**Customer Satisfaction:**
- Overall satisfaction: 68% (ranked 2 out of 5) [over 800 responses]
- Ease of use: +18% net favorability
- Security/Trust: +12% net favorability

**Top Pros:**
- User-friendly interface, especially for beginners
- Strong reputation and regulatory compliance
- Wide selection of cryptocurrencies

**Top Cons:**
- Higher fees compared to competitors (most cited concern)
- Customer service response times
- Occasional platform downtime during high volatility

**Comparison to Competitors:**

<details>
<summary>Crypto Exchange Rankings</summary>

1. Kraken: 74 GO score — Lower fees, advanced features
2. Coinbase: 72 GO score — Best for beginners
3. Binance.US: 68 GO score — Widest coin selection
</details>

Source: HundredX customer feedback (T6M ending Jun '25)`,
      success: true,
      error: null,
      _errorType: null,
      metadata: {
        enriched: true,
        intent: 'commercial',
        industry: 'Cryptocurrency Exchanges',
        brands: ['Coinbase', 'Kraken', 'Binance.US']
      },
      sources: [{
        type: 'hundredx',
        name: 'HundredX Customer Experience Data',
        description: 'Based on 800+ customer feedback responses',
        time_period: 'T6M ending Jun \'25',
        confidence: 'medium'
      }]
    }
  },

  {
    id: 'q4',
    question: 'What are the healthiest cereal brands?',
    response: {
      answer: `Based on HundredX human verified data, customers rate these cereal brands highest for health attributes:

**Top Healthy Cereal Brands:**

1. **Kashi** — GO Score: 82
   - 78% customer satisfaction [over 600 responses]
   - +32% net favorability for "nutritious/healthy"
   - Known for: Whole grains, high fiber, minimal processing

2. **Cheerios** — GO Score: 80
   - 76% customer satisfaction [over 2,400 responses]
   - +28% net favorability for "heart healthy"
   - Known for: Heart health claims, low sugar, familiar taste

3. **Nature's Path** — GO Score: 79
   - 82% customer satisfaction [over 320 responses]
   - +35% net favorability for "organic/clean ingredients"
   - Known for: Organic certification, non-GMO

**Customer Priorities:**

<details>
<summary>What Matters Most in Healthy Cereals</summary>

- Low sugar content: 68% of respondents prioritize
- High fiber: 54% prioritize
- Whole grains: 51% prioritize
- Organic ingredients: 38% prioritize
- Taste: 71% say it still needs to taste good
</details>

**Common Trade-offs:**
- Healthier options often sacrifice taste (32% mention)
- Premium pricing for organic brands (mentioned by 41%)
- Texture concerns with high-fiber varieties

Source: HundredX customer feedback (T6M ending Jun '25)`,
      success: true,
      error: null,
      _errorType: null,
      metadata: {
        enriched: true,
        intent: 'commercial',
        industry: 'Cereals & Breakfast Foods',
        brands: ['Kashi', 'Cheerios', 'Nature\'s Path']
      },
      sources: [{
        type: 'hundredx',
        name: 'HundredX Customer Experience Data',
        description: 'Based on 3,300+ customer feedback responses',
        time_period: 'T6M ending Jun \'25',
        confidence: 'high'
      }]
    }
  },

  {
    id: 'q5',
    question: 'I like e.l.f. Cosmetics — what other makeup brands should I consider?',
    response: {
      answer: `Based on HundredX human verified data, customers who like **e.l.f. Cosmetics** often also appreciate these brands:

**Top Correlated Brands:**

1. **NYX Professional Makeup** — GO Score: 84
   - 81% customer satisfaction [over 1,100 responses]
   - Similar appeal: Affordable, trend-forward, good quality
   - Shared customer overlap: 47%

2. **ColourPop** — GO Score: 83
   - 79% customer satisfaction [over 680 responses]
   - Similar appeal: Budget-friendly, fun colors, social media presence
   - Shared customer overlap: 42%

3. **Wet n Wild** — GO Score: 76
   - 72% customer satisfaction [over 520 responses]
   - Similar appeal: Drugstore pricing, surprising quality
   - Shared customer overlap: 38%

**Why e.l.f. Customers Like These Brands:**

<details>
<summary>Shared Customer Preferences</summary>

- Value for money: 89% of e.l.f. customers prioritize affordability
- Quality perception: "Better than expected for the price"
- Cruelty-free/vegan: 54% of e.l.f. customers value ethical practices
- Social media presence: Influenced by beauty influencers
- Wide shade ranges: Inclusivity matters to 63%
</details>

**What Makes Each Unique:**
- **NYX**: More extensive product range, slightly higher price point
- **ColourPop**: Online-first, frequent new launches, very trendy
- **Wet n Wild**: The most budget-friendly, long-standing drugstore favorite

Source: HundredX customer feedback (T6M ending Jun '25)`,
      success: true,
      error: null,
      _errorType: null,
      metadata: {
        enriched: true,
        intent: 'commercial',
        industry: 'Cosmetics & Makeup',
        brands: ['e.l.f.', 'NYX Professional Makeup', 'ColourPop', 'Wet n Wild']
      },
      sources: [{
        type: 'hundredx',
        name: 'HundredX Customer Experience Data',
        description: 'Based on 2,300+ customer feedback responses',
        time_period: 'T6M ending Jun \'25',
        confidence: 'high'
      }]
    }
  }
];

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEMO_QUESTIONS };
}
