<template>
  <rect
    v-for="(item, index) in items"
    v-bind="{
      x: getNumber(item?.x),
      y: getNumber(item?.y),
      fill: getFillColor(item),
      stroke: getStrokeColor(item),
      width: getNumber(item?.width),
      height: getNumber(item?.height),
      'stroke-dasharray': getStrokeDasharray(item),
    }"
    :key="index"
    stroke-width="2"
  ></rect>
</template>
<script setup>
// Shadow DOM indicator colors
const SHADOW_STROKE = '#9333ea'; // Purple for shadow DOM elements
const SHADOW_FILL = 'rgba(147, 51, 234, 0.1)';

const props = defineProps({
  items: {
    type: Object,
    default: () => ({}),
  },
  stroke: {
    type: String,
    default: null,
  },
  activeStroke: {
    type: String,
    default: null,
  },
  fill: {
    type: String,
    default: null,
  },
  activeFill: {
    type: String,
    default: null,
  },
});

function getNumber(num) {
  if (Number.isNaN(num) || !num) return 0;

  return num;
}

function getFillColor(item) {
  if (!item) return null;
  if (item.outline) return null;

  // Use purple fill for shadow DOM elements
  if (item.inShadowDom) {
    return SHADOW_FILL;
  }

  return item.highlight ? props.fill : props.activeFill || props.fill;
}

function getStrokeColor(item) {
  if (!item) return null;

  // Use purple stroke for shadow DOM elements
  if (item.inShadowDom) {
    return SHADOW_STROKE;
  }

  return item.highlight ? props.stroke : props.activeStroke || props.stroke;
}

function getStrokeDasharray(item) {
  if (!item) return null;

  // Use dashed stroke for shadow DOM elements or outlined elements
  if (item.inShadowDom || item.outline) {
    return '5,5';
  }

  return null;
}
</script>
