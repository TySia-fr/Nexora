/**
 * Cache Components requires generateStaticParams to return at least one param, but
 * the Docker build runs without a database (ADR-0006). Dynamic routes return this
 * placeholder; pages treat it as not found without querying, and real slugs are
 * rendered and cached on their first request.
 */
export const BUILD_PLACEHOLDER = "__build-placeholder__";
