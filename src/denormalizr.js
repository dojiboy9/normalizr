import IterableSchema from './IterableSchema';
import EntitySchema from './EntitySchema';
import UnionSchema from './UnionSchema';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import clone from 'lodash/clone';
import mapValues from 'lodash/mapValues';

function resolveIterable(items, schema, bag) {
  const itemSchema = schema.getItemSchema();
  const isMappable = typeof items.map === 'function';
  const schemaKey = itemSchema.getKey();

  // Handle arrayOf iterables
  if (isMappable) {
    return items.map(id => bag[schemaKey][id]);
  }

  // Handle valuesOf iterables
  return mapValues(items, (id) => bag[schemaKey][id]);
}

function resolveEntity(item, schema, bag) {
  return bag[schema.getKey()][item];
}

export function denormalizeAll(entities, schemaMap) {
  const time1 = (new Date()).getTime();
  const result = {};

  // Initialize Everything
  for (const schemaKey in entities) {
    result[schemaKey] = {};
    for (const id in entities[schemaKey]) {
      result[schemaKey][id] = clone(entities[schemaKey][id]);
    }
  }

  // Fill everything in
  for (const schemaKey in entities) {
    const schema = schemaMap[schemaKey];
    for (const id in entities[schemaKey]) {
      const obj = entities[schemaKey][id];

      for (fieldKey in schema) {
        if (fieldKey[0] === '_') continue;  // ignore private keys

        const fieldSchema = schema[fieldKey].schema;
        const fieldResolve = schema[fieldKey].resolve;

        // Extract the raw value
        let rawValue;
        if (isString(fieldResolve)) {
          rawValue = obj[fieldResolve];
        } else if (isFunction(fieldResolve)) {
          rawValue = fieldResolve(obj, entities);
        } else {
          rawValue = obj[fieldKey];
        }

        if (typeof rawValue === 'undefined') continue;

        // Resolve the rawValue based on the schema
        let resolvedValue;
        if (fieldSchema instanceof EntitySchema) {
          resolvedValue = resolveEntity(rawValue, fieldSchema, result);
        } else if (fieldSchema instanceof IterableSchema) {
          resolvedValue = resolveIterable(rawValue, fieldSchema, result);
        } else if (fieldSchema instanceof UnionSchema) {
          throw new Error('Deon was too lazy to implement UnionSchemas... Denormalize at your own peril');
        } else {
          throw new Error('Require a schema');
          resolvedValue = rawValue;
        }
        result[schemaKey][id][fieldKey] = resolvedValue;
      }
    }
  }

  return result;
}
