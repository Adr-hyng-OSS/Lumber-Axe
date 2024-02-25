class CommandFormat {
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }
    toString() {
        return this.id;
    }
}
export const CommandHandler = {
    addon: new CommandFormat("lumaxe", "Lumber Axe"),
    prefix: "-",
};
