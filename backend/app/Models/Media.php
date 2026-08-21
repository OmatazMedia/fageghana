<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Media extends Model
{
    protected $table = 'media';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['title', 'type', 'url', 'thumbnail_url', 'description', 'category', 'uploaded_by'];


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
