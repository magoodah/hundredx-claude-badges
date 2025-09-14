const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// CORS configuration for Chrome extensions and Claude.ai
const corsOptions = {
  origin: [
    /^chrome-extension:\/\/.*/,
    /^http:\/\/localhost:.*/,
    'https://claude.ai',
    /^https:\/\/.*\.claude\.ai$/
  ],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Mock data
const mockCompanies = {
  'Superstores': [
    { name: 'Walmart', feedback: 8617, nps: 45, csat: 3.8, net_intent: 65 },
    { name: 'Costco', feedback: 6525, nps: 68, csat: 4.3, net_intent: 78 },
    { name: 'Target', feedback: 4231, nps: 52, csat: 4.0, net_intent: 71 }
  ],
  'Airlines': [
    { name: 'Delta Air Lines', feedback: 15400, nps: 35, csat: 3.6, net_intent: 58 },
    { name: 'United Airlines', feedback: 14950, nps: 28, csat: 3.4, net_intent: 52 }
  ],
  'Technology': [
    { name: 'Apple', feedback: 45310, nps: 72, csat: 4.5, net_intent: 85 },
    { name: 'Samsung', feedback: 38990, nps: 64, csat: 4.2, net_intent: 79 }
  ]
};

const mockDrivers = {
  'Price': { performance: '+21.1%', leader: 'Walmart' },
  'Quality': { performance: '+15.8%', leader: 'Costco' },
  'Service': { performance: '+12.3%', leader: 'Target' },
  'Store Experience': { performance: '+18.5%', leader: 'Costco' },
  'Online Experience': { performance: '+9.7%', leader: 'Target' }
};

// Helper functions
function isCommercialQuery(query) {
  const commercialKeywords = /best|compare|vs|versus|top|which|better|good|recommend|price|quality|service|value/i;
  return commercialKeywords.test(query);
}

function extractIndustry(query) {
  if (/superstore|walmart|costco|target/i.test(query)) return 'Superstores';
  if (/airline|delta|united|flight/i.test(query)) return 'Airlines';
  if (/phone|apple|samsung|iphone/i.test(query)) return 'Technology';
  return 'Superstores'; // Default
}

function generateMockResponse(query, industry) {
  const companies = mockCompanies[industry] || mockCompanies['Superstores'];
  const topCompany = companies.reduce((prev, current) => 
    (prev.nps > current.nps) ? prev : current
  );
  const priceLeader = companies.reduce((prev, current) => 
    (prev.feedback > current.feedback) ? prev : current
  );
  
  const totalResponses = companies.reduce((sum, company) => sum + company.feedback, 0);
  
  const answer = `Based on HundredX customer experience data from ${totalResponses.toLocaleString()} verified responses:

**Customer Satisfaction Leader**
**[HX]** ${topCompany.name} leads with ${topCompany.nps} NPS and ${topCompany.csat}/5.0 customer satisfaction (${topCompany.feedback.toLocaleString()} responses, T3M ending Aug '25)

**Price Performance**
**[HX]** ${priceLeader.name} shows strongest price performance with +21.1% net positive vs competitors (${priceLeader.feedback.toLocaleString()} responses, T3M ending Aug '25)

**Key Insights:**
${companies.map(company => 
  `• ${company.name}: ${company.nps} NPS, ${company.net_intent}% purchase intent`
).join('\n')}

**[HX]** Source: HundredX verified customer feedback (Trailing 3 Months ending Aug '25)`;

  return {
    answer,
    sources: [
      {
        type: "hundredx",
        name: "HundredX Customer Experience Data",
        description: `Based on ${totalResponses.toLocaleString()} verified customer responses`,
        time_period: "T3M ending Aug '25",
        confidence: "high"
      },
      {
        type: "metric",
        name: "Customer Satisfaction",
        value: `${topCompany.nps} NPS (${topCompany.name})`,
        responses: topCompany.feedback
      }
    ],
    metadata: {
      intent: "commercial",
      industry: industry,
      criteria: ["Price", "Quality", "Service"],
      brands: companies.map(c => c.name),
      enriched: true,
      time_window: "Trailing 3 Months",
      total_rows_analyzed: companies.length * 3,
      processing_time_ms: Math.floor(Math.random() * 200) + 100
    },
    success: true,
    error: null
  };
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    database_connected: true,
    timestamp: new Date().toISOString()
  });
});

// Main query processing endpoint
app.post('/api/answer', (req, res) => {
  const { query, options = {} } = req.body;
  
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({
      answer: 'Invalid query provided.',
      sources: [],
      metadata: { error: 'Query must be a non-empty string' },
      success: false,
      error: 'Invalid query format'
    });
  }

  if (query.length > 1000) {
    return res.status(400).json({
      answer: 'Query too long. Please limit to 1000 characters.',
      sources: [],
      metadata: { error: 'Query exceeds maximum length' },
      success: false,
      error: 'Query too long'
    });
  }

  try {
    // Simulate processing delay
    setTimeout(() => {
      if (isCommercialQuery(query)) {
        const industry = extractIndustry(query);
        const response = generateMockResponse(query, industry);
        res.json(response);
      } else {
        res.json({
          answer: "This query doesn't appear to be commercial in nature. HundredX enrichment is optimized for commercial queries about customer experience, quality, price, and service comparisons.",
          sources: [],
          metadata: {
            intent: "informational",
            enriched: false
          },
          success: true,
          error: null
        });
      }
    }, Math.floor(Math.random() * 300) + 100); // Random delay 100-400ms

  } catch (error) {
    res.status(500).json({
      answer: 'An error occurred while processing your query. Please try again.',
      sources: [],
      metadata: { error: error.message },
      success: false,
      error: error.message
    });
  }
});

// Get industries
app.get('/api/industries', (req, res) => {
  res.json({
    industries: Object.keys(mockCompanies),
    default: "Superstores"
  });
});

// Get industry metrics
app.get('/api/metrics/:industry', (req, res) => {
  const { industry } = req.params;
  const companies = mockCompanies[industry];
  
  if (!companies) {
    return res.status(404).json({
      error: `Industry '${industry}' not found`
    });
  }

  res.json({
    industry: industry,
    companies: companies.map(c => ({
      name: c.name,
      feedback: c.feedback
    })),
    drivers: [
      "Price",
      "Quality", 
      "Service",
      "Online Experience",
      "Store Experience",
      "Product Selection"
    ],
    metrics: [
      "NPS",
      "CSAT", 
      "Net Intent",
      "Driver Performance"
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({
    answer: 'An internal server error occurred. Please try again.',
    sources: [],
    metadata: { error: 'Internal server error' },
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /api/health',
      'POST /api/answer',
      'GET /api/industries', 
      'GET /api/metrics/:industry'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 HundredX Mock API Server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   POST /api/answer`);
  console.log(`   GET  /api/industries`);
  console.log(`   GET  /api/metrics/:industry`);
  console.log(`\n💡 Test with:`);
  console.log(`   curl -X POST http://localhost:3000/api/answer -H "Content-Type: application/json" -d '{"query":"Which superstore has the best prices?"}'`);
});

module.exports = app;