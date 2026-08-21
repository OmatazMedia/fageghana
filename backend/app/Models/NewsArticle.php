<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsArticle extends Model
{
    protected $table = 'news_articles';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['title', 'slug', 'content', 'excerpt', 'cover_image', 'author', 'status', 'published_at', 'tags'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
