<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HomePage extends Model
{
    protected $table = 'home_pages';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['hero_title', 'hero_subtitle', 'hero_image', 'hero_cta_text', 'hero_cta_url', 'about_title', 'about_content', 'about_image', 'sections', 'seo_title', 'seo_description'];


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
