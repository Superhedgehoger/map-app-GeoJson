#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GeoMap 单文件构建脚本
======================
将所有 JS/CSS 合并内联到一个 HTML 文件中。

使用方法:
    python build-single.py

输出:
    index-single.html
"""

import os
import re

# 配置
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# HTML 模板文件
HTML_TEMPLATE = 'index.html'

# 本地 CSS 文件（按顺序）
CSS_FILES = [
    'style.css',
    'table-view-styles.css',
]

# 本地 JS 文件（按依赖顺序）
JS_FILES = [
    'marker-group.js',
    'selection-manager.js',
    'layer-stats.js',
    'custom-group-manager.js',
    'timeline-manager.js',
    'dashboard-panel.js',
    'script.js',
    'property-editor.js',
    'table-view.js',
]

# API 挂接点注释（将添加到合并后的 JS 开头）
API_HOOKS_HEADER = '''
// ============================================
// API 挂接点说明 (API Hooks Reference)
// ============================================
// 
// 以下函数是与后端 API 集成的关键入口点，
// 当前使用 localStorage 实现，后续可替换为真实 API 调用。
//
// 数据加载/保存:
// - loadGeoJSONFromStorage()  -> 可替换为 API.loadGeoJSON()
// - saveCurrentState()        -> 可替换为 API.saveGeoJSON()
// - loadArchive(name)         -> 可替换为 API.loadArchive(id)
// - saveArchive(name)         -> 可替换为 API.saveArchive(id, data)
//
// 快照操作 (timeline-manager.js):
// - TimelineManager._saveToStorage()   -> API.saveSnapshots()
// - TimelineManager._loadFromStorage() -> API.loadSnapshots()
//
// 搜索地址:
// - searchAddress() 内部调用 Nominatim，可替换为自有地理编码服务
//
// ============================================
'''

def read_file(filepath):
    """读取文件内容"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def combine_css():
    """合并所有 CSS 文件"""
    combined = []
    for css_file in CSS_FILES:
        filepath = os.path.join(BASE_DIR, css_file)
        if os.path.exists(filepath):
            content = read_file(filepath)
            combined.append(f'/* === {css_file} === */\n{content}')
            print(f'  ✓ 已合并 CSS: {css_file}')
        else:
            print(f'  ✗ 文件不存在: {css_file}')
    return '\n\n'.join(combined)

def combine_js():
    """合并所有 JS 文件并添加 API 注释"""
    combined = [API_HOOKS_HEADER]
    for js_file in JS_FILES:
        filepath = os.path.join(BASE_DIR, js_file)
        if os.path.exists(filepath):
            content = read_file(filepath)
            combined.append(f'\n// ========== {js_file} ==========\n{content}')
            print(f'  ✓ 已合并 JS: {js_file}')
        else:
            print(f'  ✗ 文件不存在: {js_file}')
    return '\n'.join(combined)

def build_single_html():
    """构建单文件 HTML"""
    print('GeoMap 单文件构建开始...\n')
    
    # 读取 HTML 模板
    html_path = os.path.join(BASE_DIR, HTML_TEMPLATE)
    html = read_file(html_path)
    
    # 合并 CSS
    print('合并 CSS 文件...')
    combined_css = combine_css()
    
    # 合并 JS
    print('\n合并 JS 文件...')
    combined_js = combine_js()
    
    # 替换本地 CSS 引用为内联样式
    # 移除: <link rel="stylesheet" href="style.css" />
    html = re.sub(
        r'<link\s+rel="stylesheet"\s+href="style\.css"\s*/?>',
        '',
        html
    )
    html = re.sub(
        r'<link\s+rel="stylesheet"\s+href="table-view-styles\.css"\s*/?>',
        '',
        html
    )
    
    # 在 </head> 前插入合并的 CSS
    css_block = f'<style>\n{combined_css}\n</style>\n</head>'
    html = html.replace('</head>', css_block)
    
    # 移除本地 JS 引用
    for js_file in JS_FILES:
        pattern = rf'<script\s+src="{re.escape(js_file)}"\s*>\s*</script>'
        html = re.sub(pattern, '', html)
    
    # 在 </body> 前插入合并的 JS
    js_block = f'<script>\n{combined_js}\n</script>\n</body>'
    html = html.replace('</body>', js_block)
    
    # 写入输出文件
    output_path = os.path.join(BASE_DIR, 'index-single.html')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    # 统计
    size_kb = os.path.getsize(output_path) / 1024
    print(f'\n✅ 构建完成: index-single.html ({size_kb:.1f} KB)')
    print(f'   路径: {output_path}')

if __name__ == '__main__':
    build_single_html()
