export default [
    {
        name: "example_video_1",
        duration: 5, // duration in seconds
        code: `import React from 'react';

export default function App() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#0f172a',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      fontSize: '4rem',
      fontWeight: 'bold'
    }}>
      <div style={{ animation: 'bounce 2s infinite' }}>
        Hello Playwright! 🚀
      </div>
      <style>{\`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-30px); }
        }
      \`}</style>
    </div>
  );
}`
    },
    {
        name: "example_video_2",
        duration: 5,
        code: `import React from 'react';

export default function App() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(45deg, #f06, #4a90e2)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      fontSize: '3rem',
      fontFamily: 'sans-serif'
    }}>
      <div>Automated Video #2 🎬</div>
    </div>
  );
}`
    }
];
