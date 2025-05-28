# Projet_CHPS0907
Projet pour la formation Méthode AGILE, on a choisit d'utiliser le projet d'imagerie médicale comme base pour avoir un vrai projet de développement.
Voici le lien du trello https://trello.com/invite/b/67c02a2504c8b84b98fb5d30/ATTI440ae144f18162c4524b2ed09819cdbd09A69254/chps0907-agilite
## Project Structure

```
my-react-website
├── public
│   ├── index.html        # Main HTML file for the application
│   └── favicon.ico       # Favicon for the website
├── src
│   ├── components
|   |   ├── App.css       # Styles for the App component
│   │   └── App.tsx       # Main component of the application
│   ├── python
│   │   └── server.py     # Backend server
│   ├── index.tsx         # Entry point of the React application
│   └── index.css         # Global styles for the application
├── package.json           # npm configuration file
├── tsconfig.json          # TypeScript configuration file
└── README.md              # Documentation for the project
```

## Getting Started

To get started with this project, follow these steps:

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

3. Install the dependencies:
   ```
   npm install
   ```

4. Start the development server:
   ```
   npm start
   ```
5. Install the python environement:
   ```
   python -m venv venv # Optional use a venv
   source venv/bin/activate
   pip install fastapi opencv-python numpy uvicorn pydicom python-multipart
   ```  

7. Start the Backend server:
   ```
   npm run backend
   ```

## Features

- TypeScript support for type safety
- Component-based architecture
- Responsive design (add styles in App.css and index.css)

## Contributing

Feel free to submit issues or pull requests for any improvements or features you'd like to see!

## License

This project is licensed under the MIT License.
