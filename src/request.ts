import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import axiosCookiejarSupport from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { HTMLElement, parse } from 'node-html-parser';

export class Request {
  axios: AxiosInstance;

  constructor(baseURL: string) {
    this.axios = axiosCookiejarSupport(
      axios.create({
        jar: new CookieJar(),
        withCredentials: true,
        baseURL,
      })
    );
  }

  async get(url: string, config?: AxiosRequestConfig) {
    return new Response(await this.axios.get(url, config));
  }

  async post(url: string, body?: any, config?: AxiosRequestConfig) {
    const data = new URLSearchParams(body)
    return new Response(await this.axios.post(url, data, config));
  }
}

export class Response {
  response: AxiosResponse;

  constructor(response: AxiosResponse) {
    this.response = response;
  }

  body() {
    return new ParsedHTML(this.response?.data)
  }

  data() {
    return this.response?.data
  }

  status() {
    return this.response?.status || 400
  }
}

export class ParsedHTML {
  body: HTMLElement | null = null;
  constructor(html: string) {
    const body = parse(html)
    if(body instanceof HTMLElement){
      this.body = body
    }
  }

  getAttr(querySelector: string, name: string) {
    return `${this.body?.querySelector(querySelector)?.attributes[name]}`
  }
}