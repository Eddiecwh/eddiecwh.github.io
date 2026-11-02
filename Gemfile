# frozen_string_literal: true

source "https://rubygems.org"

# Pinned to 7.5.x: _includes/sidebar.html, category-tree.html and js-selector.html
# are copies of 7.5 templates. 7.6 replaced the theme toggle with a dropdown,
# which crashes page scripts when paired with the 7.5 sidebar.
gem "jekyll-theme-chirpy", "~> 7.5.0"

gem "html-proofer", "~> 5.0", group: :test

platforms :windows, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "wdm", "~> 0.2.0", :platforms => [:windows]
