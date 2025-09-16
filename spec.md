# HundredX API Specification

## Overview
The HundredX API is a FastAPI-based REST service that enriches commercial queries with customer experience data from HundredX. The API analyzes user queries, determines if they are commercial in nature, and returns enhanced responses with real consumer insights.

## Base Configuration
- **Base URL**: `http://localhost:3000` (local) or `https://pulse.ngrok.pizza` (ngrok)
- **Protocol**: HTTP/HTTPS
- **Content-Type**: `application/json`
- **CORS**: Enabled for Chrome extensions and Claude.ai domains

## Endpoints

### 1. Health Check
**GET** `/api/health`

Checks the API status and database connectivity.

**Request:**
```http
GET /api/health HTTP/1.1
Host: localhost:3000
```

**Response:**
```json
{
  "status": "healthy",
  "database_connected": true,
  "timestamp": "2025-09-13T00:00:00.000000"
}
```

**Status Codes:**
- `200 OK`: Service is healthy
- `503 Service Unavailable`: Database connection failed

---

### 2. Process Query (Main Endpoint)
**POST** `/api/answer`

Processes a user query and returns HundredX-enriched response if the query is commercial in nature.

**Request:**
```http
POST /api/answer HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "query": "Which superstores have the best prices?",
  "options": {}  // Optional: future expansion for filters
}
```

**Response - Commercial Query:**
```json
{
  "answer": "Based on HundredX data from the last three months, Walmart boasts the best prices among superstores, leading by 21.1% according to 8,617 HundredX responses. However, if overall customer satisfaction is your priority, Costco is the winner, far exceeding others based on 6,525 HundredX reviews.\n\n**[HX]** Source: HundredX customer feedback (T3M ending Aug '25)",
  "sources": [
    {
      "type": "hundredx",
      "name": "HundredX Customer Experience Data",
      "description": "Based on 8,617 customer feedback responses",
      "time_period": "T3M ending Aug '25",
      "confidence": "high"
    },
    {
      "type": "metric",
      "name": "Price Performance",
      "value": "+21.1% vs competition",
      "responses": 8617
    }
  ],
  "metadata": {
    "intent": "commercial",
    "industry": "Superstores",
    "criteria": ["Price"],
    "brands": [],
    "enriched": true,
    "time_window": "Trailing 3 Months",
    "total_rows_analyzed": 29,
    "processing_time_ms": 0
  },
  "success": true,
  "error": null
}
```

**Response - Non-Commercial Query:**
```json
{
  "answer": "This query doesn't appear to be commercial in nature. HundredX enrichment is optimized for commercial queries about customer experience, quality, price, and service comparisons.",
  "sources": [],
  "metadata": {
    "intent": "informational",
    "enriched": false
  },
  "success": true,
  "error": null
}
```

**Response - Error:**
```json
{
  "answer": "An error occurred while processing your query. Please try again.",
  "sources": [],
  "metadata": {
    "error": "Database connection failed"
  },
  "success": false,
  "error": "Database connection failed"
}
```

**Status Codes:**
- `200 OK`: Request processed successfully (even for non-commercial queries)
- `400 Bad Request`: Invalid request format
- `500 Internal Server Error`: Server processing error

---

### 3. Get Industries
**GET** `/api/industries`

Returns list of available industries in the database.

**Request:**
```http
GET /api/industries HTTP/1.1
Host: localhost:3000
```

**Response:**
```json
{
  "industries": [
    "Superstores",
    "Retail",
    "E-commerce"
  ],
  "default": "Superstores"
}
```

---

### 4. Get Industry Metrics
**GET** `/api/metrics/{industry}`

Returns available metrics, companies, and drivers for a specific industry.

**Request:**
```http
GET /api/metrics/Superstores HTTP/1.1
Host: localhost:3000
```

**Response:**
```json
{
  "industry": "Superstores",
  "companies": [
    {
      "name": "Walmart",
      "feedback": 8617
    },
    {
      "name": "Costco",
      "feedback": 6525
    },
    {
      "name": "Target",
      "feedback": 4231
    }
  ],
  "drivers": [
    "Price",
    "Quality",
    "Service",
    "Online Experience",
    "Store Experience",
    "Product Selection"
  ],
  "metrics": [
    "NPS",
    "CSAT",
    "Net Intent",
    "Driver Performance"
  ]
}
```

---

## Query Processing Logic

### Intent Classification
The API classifies queries into these categories:
- **commercial**: Product/service comparisons, "best" queries, versus queries
- **informational**: "What is", "How to", historical questions
- **navigational**: Store hours, locations, contact info
- **transactional**: Direct purchase intent

Only **commercial** queries receive HundredX enrichment.

### Commercial Query Patterns
Queries are considered commercial if they contain:
- Comparison keywords: "best", "top", "compare", "vs", "versus"
- Quality indicators: "good", "better", "worst", "recommend"
- Commercial attributes: "price", "quality", "service", "value"
- Brand comparisons: "Walmart vs Costco"

### Response Enhancement
For commercial queries, the API:
1. Extracts brands and criteria from the query
2. Queries HundredX database for relevant metrics
3. Applies statistical thresholds (min 500 responses for brands, 300 for drivers)
4. Formats response with **[HX]** attribution tags
5. Includes response counts and time windows

---

## Mock Data for Testing

### Mock Commercial Response
```javascript
const mockCommercialResponse = {
  answer: `Based on HundredX data, here are the key insights:

**Price Leadership**
[HX] Walmart leads on price with +21.1% net positive vs competitors (8,617 responses, T3M ending Aug '25)

**Customer Satisfaction**
[HX] Costco achieves highest overall satisfaction at 82% net positive (6,525 responses, T3M ending Aug '25)

**Service Quality**
[HX] Target excels in customer service with +15.3% above average (4,231 responses, T3M ending Aug '25)`,

  sources: [
    {
      type: "hundredx",
      name: "HundredX Customer Experience Data",
      description: "Based on 19,373 total customer responses",
      time_period: "T3M ending Aug '25",
      confidence: "high"
    }
  ],

  metadata: {
    intent: "commercial",
    industry: "Superstores",
    criteria: ["Price", "Service", "Quality"],
    brands: ["Walmart", "Costco", "Target"],
    enriched: true,
    time_window: "Trailing 3 Months",
    total_rows_analyzed: 45
  },

  success: true,
  error: null
};
```

### Mock Non-Commercial Response
```javascript
const mockNonCommercialResponse = {
  answer: "This query doesn't appear to be commercial in nature. HundredX enrichment is optimized for commercial queries about customer experience, quality, price, and service comparisons.",
  sources: [],
  metadata: {
    intent: "informational",
    enriched: false
  },
  success: true,
  error: null
};
```

---

## Error Handling

### Error Response Format
All errors follow this structure:
```json
{
  "answer": "An error occurred while processing your query. Please try again.",
  "sources": [],
  "metadata": {
    "error": "<error_message>"
  },
  "success": false,
  "error": "<error_message>"
}
```

### Common Error Scenarios
1. **Invalid Query Format**: Missing or malformed query field
2. **Database Unavailable**: SQLite connection failed
3. **No Data Available**: Industry or brand not in database
4. **Processing Error**: Internal server error during analysis

---

## Implementation Notes

### CORS Configuration
```python
allow_origins = [
  "chrome-extension://*",
  "http://localhost:*",
  "https://claude.ai",
  "https://*.claude.ai"
]
```

### Request Validation
- Query must be a non-empty string
- Query length should not exceed 1000 characters
- Options field is optional and reserved for future use

### Response Formatting
- All responses are JSON with consistent structure
- Markdown formatting supported in answer field
- **[HX]** tags indicate HundredX-sourced claims
- Response counts and time windows always included for transparency

### Performance Considerations
- Database queries optimized with indexes on industry, company, month_year
- Response time typically < 500ms for standard queries
- Caching not implemented (data updates monthly)

---

## Testing the API

### Using cURL
```bash
# Health check
curl http://localhost:3000/api/health

# Commercial query
curl -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query": "Which superstore has the best prices?"}'

# Get industries
curl http://localhost:3000/api/industries

# Get metrics for industry
curl http://localhost:3000/api/metrics/Superstores
```

### Using JavaScript/Fetch
```javascript
// Commercial query example
async function queryHundredX(query) {
  const response = await fetch('http://localhost:3000/api/answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });

  return await response.json();
}

// Usage
const result = await queryHundredX("Which stores have the best customer service?");
console.log(result.answer);
```

### Mock Server Implementation
For testing without the backend, implement these responses:

```javascript
class MockHundredXAPI {
  async answer(query) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check if commercial
    const isCommercial = /best|compare|vs|versus|top|which/i.test(query);

    if (isCommercial) {
      return {
        answer: "[HX] Based on analysis of 10,000+ responses: Store A leads in the mentioned criteria with 85% positive feedback (T3M ending Aug '25)",
        sources: [{
          type: "hundredx",
          name: "HundredX Customer Data",
          description: "10,000+ responses",
          confidence: "high"
        }],
        metadata: {
          intent: "commercial",
          enriched: true
        },
        success: true
      };
    }

    return {
      answer: "This query doesn't appear to be commercial in nature.",
      sources: [],
      metadata: {
        intent: "informational",
        enriched: false
      },
      success: true
    };
  }

  async health() {
    return {
      status: "healthy",
      database_connected: true,
      timestamp: new Date().toISOString()
    };
  }
}
```

---

## Chrome Extension Integration

### Configuration
```javascript
// config.js
export const API_CONFIG = {
  baseUrl: 'http://localhost:3000',  // or ngrok URL
  endpoints: {
    health: '/api/health',
    answer: '/api/answer',
    industries: '/api/industries',
    metrics: '/api/metrics'
  },
  timeout: 30000,  // 30 seconds
  retries: 2
};
```

### API Client
```javascript
class HundredXAPIClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async processQuery(query) {
    try {
      const response = await fetch(`${this.baseUrl}/api/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        answer: "Unable to reach HundredX service. Please try again.",
        sources: [],
        metadata: { error: error.message },
        success: false,
        error: error.message
      };
    }
  }
}
```

---

## Database Schema Reference

### key_metrics_export
- **industry**: "Superstores", "Retail", etc.
- **company**: "Walmart", "Costco", "Target", etc.
- **month_year**: "2025-08-01" (normalized to first of month)
- **trailing_period**: "Trailing 3 Months", "Trailing 12 Months"
- **feedback_count_brand**: Integer count of responses
- **nps_brand**: Net Promoter Score (-100 to 100)
- **csat_avg_brand**: Customer Satisfaction Average (0-5)
- **net_intent_brand**: Purchase intent (-100 to 100)

### driver_metrics_export
- **driver**: "Price", "Quality", "Service", etc.
- **driver_response_volume_brand**: Number of responses for driver
- **driver_net_positive_pct_brand**: Percentage positive (0-1)
- **driver_selection_freq_brand**: How often driver is mentioned (0-1)

---

This specification should provide everything needed to recreate or mock the API for Chrome extension development and testing.
