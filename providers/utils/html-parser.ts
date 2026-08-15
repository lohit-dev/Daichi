// ---------------------------------------------------------------------------
// htmlparser2 wrapper — lightweight DOM query helpers for React Native
// ---------------------------------------------------------------------------

import { parseDocument } from 'htmlparser2';
import { Document, Element, AnyNode, isTag } from 'domhandler';
import { findAll, findOne, getAttributeValue, textContent, getChildren } from 'domutils';

export class HtmlDoc {
  private doc: Document;

  constructor(html: string) {
    this.doc = parseDocument(html);
  }

  querySelector(tag: string, attrs?: Record<string, string>): Element | null {
    return findOne((elem) => this._matches(elem, tag, attrs), this.doc.children);
  }

  querySelectorAll(tag: string, attrs?: Record<string, string>): Element[] {
    return findAll((elem) => this._matches(elem, tag, attrs), this.doc.children);
  }

  querySelectorClass(tag: string, className: string): Element[] {
    return findAll(
      (elem) => isTag(elem) && elem.name === tag && HtmlDoc._hasClass(elem, className),
      this.doc.children
    );
  }

  querySelectorClassOne(tag: string, className: string): Element | null {
    return findOne(
      (elem) => isTag(elem) && elem.name === tag && HtmlDoc._hasClass(elem, className),
      this.doc.children
    );
  }

  static children(elem: Element | null): Element[] {
    if (!elem) return [];
    return getChildren(elem).filter(isTag) as Element[];
  }

  static text(elem: AnyNode | AnyNode[] | null | undefined): string {
    if (!elem) return '';
    return textContent(elem).trim();
  }

  static attr(elem: Element | null, name: string): string | undefined {
    if (!elem) return undefined;
    return getAttributeValue(elem, name);
  }

  static hasClass(elem: Element, className: string): boolean {
    return this._hasClass(elem, className);
  }

  static querySelector(
    elem: Element | null,
    tag: string,
    attrs?: Record<string, string>
  ): Element | null {
    if (!elem) return null;
    return findOne((child) => HtmlDoc._matchesStatic(child, tag, attrs), [elem]);
  }

  static querySelectorAll(
    elem: Element | null,
    tag: string,
    attrs?: Record<string, string>
  ): Element[] {
    if (!elem) return [];
    return findAll((child) => HtmlDoc._matchesStatic(child, tag, attrs), [elem]);
  }

  static querySelectorClass(elem: Element | null, tag: string, className: string): Element[] {
    if (!elem) return [];
    return findAll(
      (child) => isTag(child) && child.name === tag && HtmlDoc._hasClass(child, className),
      [elem]
    );
  }

  static querySelectorClassOne(
    elem: Element | null,
    tag: string,
    className: string
  ): Element | null {
    if (!elem) return null;
    return findOne(
      (child) => isTag(child) && child.name === tag && HtmlDoc._hasClass(child, className),
      [elem]
    );
  }

  private static _hasClass(elem: Element, className: string): boolean {
    const cls = getAttributeValue(elem, 'class') || '';
    return cls.split(/\s+/).filter(Boolean).includes(className);
  }

  private _matches(elem: AnyNode, tag: string, attrs?: Record<string, string>): boolean {
    return HtmlDoc._matchesStatic(elem, tag, attrs);
  }

  private static _matchesStatic(
    elem: AnyNode,
    tag: string,
    attrs?: Record<string, string>
  ): boolean {
    if (!isTag(elem) || elem.name !== tag) return false;
    if (!attrs) return true;
    return Object.entries(attrs).every(([key, value]) => {
      const attrVal = getAttributeValue(elem, key);
      if (attrVal === undefined) return false;
      if (key === 'class') {
        return attrVal.split(/\s+/).filter(Boolean).includes(value);
      }
      return attrVal === value;
    });
  }
}

export function loadHtml(html: string): HtmlDoc {
  return new HtmlDoc(html);
}
