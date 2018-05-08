const gulp = require("gulp");
const gutil = require("gulp-util");

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

gulp.task("test", (done) => {

  const child = childProcess.spawn("node", ["./node_modules/vscode/bin/test"], {
      cwd: __dirname,
      env: Object.assign({}, process.env, { CODE_TESTS_WORKSPACE: path.join(__dirname, "test/resources/project1/project.code-workspace") }),
  });

  child.stdout.on("data", (data) => {
      gutil.log(data.toString().trim());
  });

  child.stderr.on("data", (data) => {
      gutil.log(gutil.colors.red(data.toString().trim()));
  });

  child.on("error", (error) => {
      gutil.log(gutil.colors.red(error));
  });

  child.on("exit", (code) => {
      if (code === 0) {
          done();
      } else {
          done(code);
      }
  });
});