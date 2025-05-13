class MarkManager {
  private marks: { [key: string]: { label: string, color: string, note: string } } = {};

  setMark(filePath: string, label: string, note: string | undefined) {
    this.marks[filePath] = {
      label,
      color: this.getLabelColor(label),
      note: note || ''
    };
  }

  getMark(filePath: string) {
    return this.marks[filePath];
  }

  private getLabelColor(label: string): string {
    switch (label) {
      case '✔️ Completed':
        return "#00ff00";
      case '🕗 Halfway':
        return "#ff9900";
      case '❌ Unread':
        return "#ff0000";
      default:
        return "#000000";
    }
  }
}
export default MarkManager;
