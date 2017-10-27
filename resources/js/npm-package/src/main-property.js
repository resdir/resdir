export default base =>
  class MainProperty extends base {
    toPackageMainProperty() {
      let main = this.es5;
      if (main && main.startsWith('./')) {
        main = main.slice(2);
      }
      return main;
    }

    static $normalize(definition, options) {
      if (typeof definition === 'string') {
        definition = {es5: definition};
      }
      return super.$normalize(definition, options);
    }

    $serialize(options) {
      let definition = super.$serialize(options);

      if (definition) {
        const keys = Object.keys(definition);
        if (keys.length === 1 && keys[0] === 'es5') {
          definition = definition.es5;
        }
      }

      return definition;
    }
  };
