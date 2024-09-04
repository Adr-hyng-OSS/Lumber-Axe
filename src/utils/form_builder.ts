export class FormBuilder<T extends boolean | string> {
  values?: string[];
  defaultValue: T;
  name: string;

  constructor(name: string) {
    this.name = name;
    this.values = [];
  }

  createToggle(defaultValue: boolean): this {
    this.defaultValue = defaultValue as T;
    return this;
  }

  createTextField(defaultValue: string): this {
    this.defaultValue = defaultValue as T;
    return this;
  }

  createDropdown(dropDownOptions: string[], defaultValue: string): this {
    this.defaultValue = defaultValue as T;
    this.values = dropDownOptions as string[];
    return this;
  }
}