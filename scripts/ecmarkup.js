function wrapWarnFunction(originalWarn) {
  return (err) => {
    if (
      err.message.includes("Completion Record") ||
      err.message.includes("an abrupt completion")
    ) {
      // Ignore errors about completion records
      return;
    }

    let match;
    if (match = /^could not find definition for (\w+)$/.exec(err.message)) {
      switch (match[1]) {
        // This is correctly <dfn>ed as a reference from an external
        // specification. However, ecmarkup only allows "calling" AOs and not
        // <dfn>ed terms.
        case "module_decode":
        // Ecmarkup mistakenly detects HTTP in "an HTTP(S) scheme" as an AO
        // call.
        case "HTTP":
          return;
      }
    }

    originalWarn(err);
  };
}

Object.defineProperty(Object.prototype, "warn", {
  enumerable: false,
  configurable: true,
  get: () => undefined,
  set(value) {
    // Trying to detect this object:
    // https://github.com/tc39/ecmarkup/blob/734baa009be2bdbab29c14a9e52ed3da1e26caa3/src/cli.ts#L104
    if (
      Object.hasOwn(this, "multipage") &&
      Object.hasOwn(this, "outfile") &&
      Object.hasOwn(this, "extraBiblios") &&
      Object.hasOwn(this, "lintSpec")
    ) {
      value = wrapWarnFunction(value);
    }
    Object.defineProperty(this, "warn", {
      enumerable: true,
      configurable: true,
      writable: true,
      value,
    });
  },
});

require("ecmarkup/bin/ecmarkup.js");
