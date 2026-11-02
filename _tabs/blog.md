---
layout: page
title: Blog Posts
icon: fas fa-pen-nib
order: 2
permalink: /blog/
---

Build logs, design notes, and the occasional detour. Mostly backend systems and
applied AI, written down while I'm still figuring them out.

<section class="blog-categories" aria-labelledby="blog-categories-heading">
  <h2 class="section-heading" id="blog-categories-heading">browse by category</h2>
  {% include category-tree.html %}
</section>

<section class="blog-latest-section" aria-labelledby="blog-latest-heading">
  <h2 class="section-heading" id="blog-latest-heading">latest posts</h2>
  {% include blog-posts.html %}
</section>

<p class="section-more">
  <a href="{{ '/archives/' | relative_url }}">all posts by date <span aria-hidden="true">→</span></a>
</p>
