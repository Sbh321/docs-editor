/** Base class for every error a {@link Schema} throws. */
export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnknownNodeTypeError extends SchemaError {
  constructor(public readonly nodeType: string) {
    super(
      `Unknown node type "${nodeType}". Declare it in the schema's "nodes" spec before using it.`,
    );
  }
}

export class UnknownMarkTypeError extends SchemaError {
  constructor(public readonly markType: string) {
    super(
      `Unknown mark type "${markType}". Declare it in the schema's "marks" spec before using it.`,
    );
  }
}

export class InvalidContentExpressionError extends SchemaError {
  constructor(
    public readonly nodeType: string,
    public readonly expression: string,
    public readonly token: string,
  ) {
    super(
      `Invalid content expression "${expression}" for node "${nodeType}": malformed term "${token}". ` +
        `Expected a node/group name optionally followed by *, +, or ?.`,
    );
  }
}

export class UnknownContentReferenceError extends SchemaError {
  constructor(
    public readonly nodeType: string,
    public readonly expression: string,
    public readonly reference: string,
  ) {
    super(
      `Content expression "${expression}" for node "${nodeType}" references "${reference}", which ` +
        `is not a declared node type or group.`,
    );
  }
}

export class InvalidContentError extends SchemaError {
  constructor(
    public readonly nodeType: string,
    public readonly expression: string,
    public readonly received: readonly string[],
  ) {
    super(
      `Invalid content for node "${nodeType}": [${received.join(", ")}] does not match content ` +
        `expression "${expression}".`,
    );
  }
}

export class InvalidAttributeError extends SchemaError {
  constructor(
    public readonly ownerType: string,
    public readonly attribute: string,
    public readonly reason: string,
  ) {
    super(`Invalid attribute "${attribute}" on "${ownerType}": ${reason}`);
  }
}

export class InvalidMarkError extends SchemaError {
  constructor(
    public readonly nodeType: string,
    public readonly markType: string,
    public readonly reason: string,
  ) {
    super(`Cannot apply mark "${markType}" to node "${nodeType}": ${reason}`);
  }
}
