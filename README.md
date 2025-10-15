# n8n-nodes-metis

[![n8n community package](https://img.shields.io/badge/n8n-community-blue.svg)](https://n8n.io/)

A collection of n8n community nodes for integrating with Metis AI platform.

## Nodes

This package provides two nodes for Metis AI integration:

### 1. Metis: Create Generation
Create AI content generations using various providers and models supported by Metis.

**Features:**
- Dynamic provider and model selection
- Flexible parameter configuration based on selected model
- Support for multiple AI providers (OpenAI, Anthropic, etc.)
- Schema-based argument validation

### 2. Metis: Message Chatbot
Create or reuse chat sessions and send messages to Metis chatbots.

**Features:**
- Create new chat sessions or continue existing ones
- Support for USER and TOOL message types
- Session management for persistent conversations
- Bot ID configuration for different chatbot instances

## Prerequisites

- n8n instance (version 1.0.0 or later)
- Metis API key

## Installation

### Using n8n CLI

```bash
npm install n8n-nodes-metis
```

### Manual Installation

1. Clone this repository:
```bash
git clone https://github.com/Metis-Inc/n8n-nodes-metis.git
```

2. Install dependencies:
```bash
cd n8n-nodes-metis
npm install
```

3. Build the package:
```bash
npm run build
```

4. Copy the `dist` folder to your n8n custom nodes directory

## Setup

### 1. Get Metis API Key
Visit [Metis AI](https://console.metisai.ir/api-keys) to obtain your API key.

### 2. Configure Credentials in n8n
1. In your n8n instance, go to **Settings > Credentials**
2. Create new credentials for **Metis API**
3. Enter your API key

### 3. Add Nodes to Workflow
The Metis nodes will now be available in your n8n node palette under the **Transform** category.

## Usage Examples

### Basic Generation
1. Add the **Metis: Create Generation** node to your workflow
2. Select a provider and model
3. Configure the generation parameters
4. Connect to other nodes to process the generated content

### Chatbot Integration
1. Add the **Metis: Message Chatbot** node to your workflow
2. Enter your Bot ID
3. Optionally provide a Session ID (leave empty for new sessions)
4. Set message type and content
5. The node will return the chatbot's response

## Development

### Building
```bash
npm run build
```

### Development Setup
```bash
npm install
npm run build
# The built files will be in the `dist/` directory
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Create an issue on [GitHub](https://github.com/Metis-Inc/n8n-nodes-metis/issues)
- Visit [Metis AI Documentation](https://docs.metisai.ir)

## Links

- [n8n Documentation](https://docs.n8n.io/)
- [Metis AI](https://metisai.ir)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
