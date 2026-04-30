const { Project, SyntaxKind } = require("ts-morph");
const path = require("path");
const fs = require("fs");

// Adjust this to your actual DTO folder path
const DTO_FOLDER = path.join(__dirname, "src", "dto");

const project = new Project({
  tsConfigFilePath: path.join(__dirname, "tsconfig.json"),
});

project.addSourceFilesAtPaths(`${DTO_FOLDER}/**/*.ts`);

const sourceFiles = project.getSourceFiles();

sourceFiles.forEach((sourceFile) => {
  const classes = sourceFile.getClasses();

  if (classes.length === 0) return;

  let addedImport = false;

  // Add import if not exists
  const existingImports = sourceFile.getImportDeclarations().some((imp) =>
    imp.getModuleSpecifier().getLiteralText() === "@nestjs/swagger"
  );

  if (!existingImports) {
    sourceFile.addImportDeclaration({
      namedImports: ["ApiProperty"],
      moduleSpecifier: "@nestjs/swagger",
    });
    addedImport = true;
  }

  classes.forEach((cls) => {
    cls.getProperties().forEach((prop) => {
      const hasApiProperty = prop.getDecorators().some((dec) => dec.getName() === "ApiProperty");

      if (!hasApiProperty) {
        prop.addDecorator({
          name: "ApiProperty",
          arguments: [],
        });
      }
    });
  });

  if (addedImport || sourceFile.getFullText().includes("@ApiProperty")) {
    sourceFile.saveSync();
    console.log(`Updated: ${sourceFile.getFilePath()}`);
  }
});
