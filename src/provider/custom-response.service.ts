export default class CustomResponse {
  static error(arg0: string) {
    throw new Error('Method not implemented.');
  }
  public status: number;
  public message: string;
  public data: any;
  constructor(status: number = 200, message: string, data?: any) {
    this.status = status;
    this.message = message;
    this.data = data;
  }
}