export class FormBuilder {
    constructor(name) {
        this.name = name;
        this.values = [];
    }
    createToggle(defaultValue) {
        this.defaultValue = defaultValue;
        return this;
    }
    createTextField(defaultValue) {
        this.defaultValue = defaultValue;
        return this;
    }
    createDropdown(dropDownOptions, defaultValue) {
        this.defaultValue = defaultValue;
        this.values = dropDownOptions;
        return this;
    }
}
