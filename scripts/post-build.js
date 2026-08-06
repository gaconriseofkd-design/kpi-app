// scripts/post-build.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distHtmlPath = path.join(__dirname, '..', 'dist', 'index.html');

if (fs.existsSync(distHtmlPath)) {
  let content = fs.readFileSync(distHtmlPath, 'utf8');
  
  // Remove crossorigin attribute (which causes CORS blocks on file://)
  content = content.replace(/\scrossorigin(=("[^"]*"|'[^']*'|\S+))?/gi, '');

  // Ensure type="module" is present so Vite's ES module bundle executes properly
  content = content.replace(/<script\s+src=/gi, '<script type="module" src=');

  // Fix double type="module" if already present
  content = content.replace(/type="module"\s+type="module"/gi, 'type="module"');
  
  // Ensure relative paths starting with ./
  content = content.replace(/src="\/assets\//g, 'src="./assets/');
  content = content.replace(/href="\/assets\//g, 'href="./assets/');

  fs.writeFileSync(distHtmlPath, content, 'utf8');
  console.log('✅ [post-build] Successfully optimized dist/index.html for local file:// protocol!');
} else {
  console.error('❌ [post-build] dist/index.html not found.');
}
