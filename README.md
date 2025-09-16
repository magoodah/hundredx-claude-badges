# HundredX Claude Enhancement Extension

A Chrome extension that enhances Claude AI responses with real-time HundredX customer experience insights, providing verified consumer data alongside AI-generated content.

![Extension Demo](https://img.shields.io/badge/Chrome_Extension-MV3-blue?logo=googlechrome) ![License](https://img.shields.io/badge/License-MIT-green) ![Version](https://img.shields.io/badge/Version-0.1.0-orange)

## 🎯 Overview

This extension demonstrates how HundredX's proprietary customer experience data can augment AI search results to provide more trustworthy, grounded insights. When users ask commercial questions on Claude.ai, the extension automatically displays relevant HundredX consumer insights in a beautiful side-by-side panel.

### Key Features

- 🚀 **Real-time Integration** - Connects to live HundredX API for fresh consumer insights
- 🎨 **Professional UI** - Smooth animations and skeleton loading states
- 🧠 **Smart Detection** - Only activates on substantial commercial queries
- 📊 **Rich Data** - Displays customer satisfaction scores, review counts, and key insights
- 🛡️ **Robust Error Handling** - Comprehensive retry logic and user-friendly error states
- 📱 **Responsive Design** - Works across different screen sizes with graceful fallbacks

## 🏗️ Architecture

### Core Components

- **`content.js`** - Main content script with DOM manipulation and API integration
- **`styles.css`** - Professional styling with animations and responsive design
- **`manifest.json`** - Chrome Extension MV3 configuration
- **`mock-api.js`** - Development API server for testing
- **`brands.json`** - Sample brand data for development

### Technical Stack

- **Chrome Extension Manifest V3**
- **Vanilla JavaScript** (no dependencies)
- **CSS3** with modern animations
- **REST API** integration
- **Shadow DOM** for style isolation

## 🚀 Quick Start

### Prerequisites

- Chrome browser (version 88+)
- Node.js (for development API server)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/magoodah/hundredx-claude-badges.git
   cd hundredx-claude-badges
   ```

2. **Install dependencies** (for development server)
   ```bash
   npm install
   ```

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked" and select the project directory

4. **Test the extension**
   - Visit [Claude.ai](https://claude.ai)
   - Ask a commercial question like: *"Which superstore has the best customer service?"*
   - Watch the HundredX insights appear alongside Claude's response!

## 🔧 Development

### Running the Development Server

The extension can work with either the live HundredX API or a local development server:

```bash
# Start the mock development server
npm start

# Server will run on http://localhost:3000
```

### API Configuration

The extension is configured to use the live HundredX API by default:

```javascript
const API_BASE_URL = 'https://pulse.ngrok.pizza';
```

To switch to the development server, change this to:

```javascript
const API_BASE_URL = 'http://localhost:3000';
```

### Project Structure

```
hundredx-claude-badges/
├── manifest.json           # Extension configuration
├── content.js              # Main content script
├── styles.css              # Styling and animations
├── panel.html              # Popup panel template
├── brands.json             # Sample brand data
├── mock-api.js             # Development API server
├── package.json            # Node.js dependencies
├── icons/                  # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── HundredX+Logo+...webp   # Brand assets
```

## 🎨 User Experience

### Animation System

The extension features a sophisticated multi-layer animation system:

1. **Container Animation** - Smooth fade-in with upward slide
2. **Panel Entrance** - Side slide-in with scale effect
3. **Header Animation** - Branded header slides down
4. **Content Reveal** - Staggered paragraph animations
5. **Loading States** - Professional skeleton UI with shimmer effects

### Error Handling

Comprehensive error handling with user-friendly messaging:

- **Network Issues** - Connection problem detection with retry options
- **Timeouts** - 15-second timeout with exponential backoff
- **Server Errors** - Graceful degradation with service status
- **Manual Recovery** - Retry and dismiss buttons for user control

## 📊 API Integration

### Endpoints Used

- `GET /api/health` - Service health check
- `POST /api/answer` - Main query processing endpoint
- `GET /api/industries` - Available industry categories
- `GET /api/metrics/{industry}` - Industry-specific metrics

### Response Format

The API returns structured responses with:

```json
{
  "answer": "HundredX insights with [HX] attribution...",
  "sources": [{
    "type": "hundredx",
    "description": "Based on X verified responses",
    "confidence": "high"
  }],
  "metadata": {
    "intent": "commercial",
    "industry": "Superstores",
    "enriched": true
  },
  "success": true
}
```

## 🔒 Privacy & Security

- **Minimal Permissions** - Only requests necessary Chrome permissions
- **No Data Collection** - Extension doesn't store or track user data
- **Secure API Calls** - All requests use HTTPS
- **Content Isolation** - Uses Shadow DOM to prevent style conflicts

## 🚀 Deployment

### Production Build

1. **Update API endpoint** in `content.js` if needed
2. **Test thoroughly** with live API
3. **Package for Chrome Web Store**:
   ```bash
   # Create a zip file excluding development files
   zip -r hundredx-extension.zip . -x "node_modules/*" "*.log" ".git/*"
   ```

### Chrome Web Store

Ready for submission to Chrome Web Store with:
- ✅ Manifest V3 compliance
- ✅ Proper permissions and host declarations
- ✅ Professional icons and branding
- ✅ Comprehensive error handling

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes and test thoroughly**
4. **Commit with descriptive messages**
5. **Push to your branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Code Standards

- Use meaningful variable names and comments
- Follow existing animation and styling patterns
- Test across different screen sizes
- Ensure error handling for all API calls
- Maintain compatibility with Chrome MV3

## 📈 Performance

- **Lightweight** - Minimal impact on page load times
- **Efficient DOM Queries** - Optimized selectors and caching
- **Smart Activation** - Only processes relevant commercial queries
- **Memory Management** - Proper cleanup and WeakSet usage
- **API Optimization** - Request deduplication and timeout handling

## 🐛 Troubleshooting

### Common Issues

**Extension not working?**
- Check if extension is enabled in `chrome://extensions/`
- Verify no errors shown in extension details
- Try reloading the extension

**No HundredX panel appearing?**
- Ensure you're asking commercial questions (include words like "best", "compare", "vs")
- Check browser console for debug logs starting with "🔍 HundredX DEBUG:"
- Verify API connectivity at https://pulse.ngrok.pizza/api/health

**Still seeing mock data?**
- Confirm `API_BASE_URL` is set to live endpoint
- Clear browser cache and reload extension
- Check network tab for actual API calls

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **HundredX** - For providing customer experience data and insights
- **Claude AI** - For the intelligent response platform
- **Chrome Extensions Team** - For the robust extension platform

---

**Built with ❤️ for demonstrating the power of customer experience data in AI-enhanced search results.**
