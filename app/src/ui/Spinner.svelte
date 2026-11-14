<script lang="ts">
  let {size=24}:{size?:number}=$props();
</script>
<span class="spinner" aria-hidden="true" style:width={size+'px'} style:height={size+'px'}></span>
<style>
  .spinner{display:inline-block;flex:none;border:2px solid var(--hairline);border-top-color:var(--rubric);border-radius:50%;animation:spin .8s linear infinite;will-change:transform;}
  @keyframes spin{to{transform:rotate(360deg);}}
  @media(prefers-reduced-motion:reduce){.spinner{animation:none;}}
</style>
