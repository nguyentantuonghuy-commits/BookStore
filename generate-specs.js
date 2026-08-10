const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const srcDir = path.resolve('src/app');

walkDir(srcDir, filePath => {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  // Skip tests, routes, config, guards, data, interfaces, etc.
  if (ext !== '.ts') return;
  if (filePath.endsWith('.spec.ts')) return;
  if (filePath.endsWith('.routes.ts')) return;
  if (filePath.endsWith('.config.ts')) return;
  if (filePath.endsWith('.guard.ts')) return;
  if (filePath.includes(path.sep + 'guards' + path.sep)) return;
  if (filePath.includes(path.sep + 'interfaces' + path.sep)) return;
  if (filePath.includes(path.sep + 'data' + path.sep)) return;
  if (filePath.includes(path.sep + 'utils' + path.sep)) return;
  if (base === 'app' || base === 'main') return; // app.spec.ts already exists

  const content = fs.readFileSync(filePath, 'utf8');
  const classMatch = content.match(/export class (\w+)/);
  if (!classMatch) return;

  const className = classMatch[1];
  const specPath = path.join(path.dirname(filePath), `${base}.spec.ts`);

  // Only write if spec doesn't exist already
  if (fs.existsSync(specPath)) {
    console.log(`Spec already exists: ${specPath}`);
    return;
  }

  let specContent = '';

  if (content.includes('@Component')) {
    // Relative path to app.routes
    const routesFullPath = path.resolve('src/app/app.routes');
    let relRoutes = path.relative(path.dirname(filePath), routesFullPath);
    relRoutes = relRoutes.replace(/\.ts$/, '').replace(/\\/g, '/');
    if (!relRoutes.startsWith('.')) {
      relRoutes = './' + relRoutes;
    }

    specContent = `import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ${className} } from './${base}';
import { routes } from '${relRoutes}';

describe('${className}', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [${className}],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(${className});
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
`;
  } else if (content.includes('@Injectable')) {
    specContent = `import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ${className} } from './${base}';

describe('${className}', () => {
  let service: ${className};

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ${className},
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(${className});
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
`;
  } else {
    // General class test
    specContent = `import { ${className} } from './${base}';

describe('${className}', () => {
  it('should exist', () => {
    expect(${className}).toBeTruthy();
  });
});
`;
  }

  fs.writeFileSync(specPath, specContent, 'utf8');
  console.log(`Created spec for ${className} at ${specPath}`);
});
