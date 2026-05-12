export default class CustomError {
  private statusCode: number;
  timestamp = new Date().toISOString();
  public message: any;

  constructor(statusCode: number = 500, message?: string) {
    this.statusCode = statusCode; // default to 500 if not passed
    this.message = message;
  }
}
